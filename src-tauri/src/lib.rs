pub mod auto_respond;
pub mod commands;
pub mod cost;
pub mod git;
pub mod pty_stream;
pub mod session;
pub mod session_meta;
pub mod status;
pub mod stuck_detector;
pub mod templates;

/// Process-wide mutex for tests that mutate the HOME env var.
/// Shared across all test modules to prevent race conditions.
#[cfg(test)]
pub(crate) static TEST_HOME_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

use pty_stream::PtyManager;
use session::SessionManager;
use std::sync::Arc;
use tauri::Manager;
use tauri::menu::{MenuBuilder, SubmenuBuilder, PredefinedMenuItem};

pub struct AppState {
    pub session_mgr: Arc<SessionManager>,
    pub pty_mgr: Arc<PtyManager>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            session_mgr: Arc::new(SessionManager::new()),
            pty_mgr: Arc::new(PtyManager::new()),
        })
        .setup(|app| {
            // Custom minimal menu: only essential macOS items (Quit, Copy, Paste, etc.)
            // This prevents the default menu from intercepting Cmd+N, Cmd+W, Cmd+T, etc.
            let app_menu = SubmenuBuilder::new(app, "Luffy")
                .about(None)
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;
            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;
            let window_menu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .item(&PredefinedMenuItem::fullscreen(app, None)?)
                .close_window()
                .build()?;
            let menu = MenuBuilder::new(app)
                .items(&[&app_menu, &edit_menu, &window_menu])
                .build()?;
            app.set_menu(menu)?;

            let app_handle = app.handle().clone();
            let state = app.state::<AppState>();
            let session_mgr = state.session_mgr.clone();
            let pty_mgr = state.pty_mgr.clone();

            // Background health monitor: every 10s, check if tmux sessions are still alive,
            // auto-remove DONE/ERROR sessions older than 30 minutes, and auto-respond to
            // WAITING sessions that match configured auto-response patterns.
            tauri::async_runtime::spawn(async move {
                let mut tick = 0u32;
                // Track last auto-respond per session: session_id → last preview that was responded to
                let mut last_auto_responded: std::collections::HashMap<String, String> =
                    std::collections::HashMap::new();
                // Detect THINKING sessions stuck with no output change for 15 minutes
                let mut stuck_detector = stuck_detector::StuckDetector::new(15 * 60);
                // Track whether there were active (THINKING/WAITING) sessions last tick
                // for batch-done notification
                let mut had_active_sessions = false;
                loop {
                    tokio::time::sleep(std::time::Duration::from_secs(10)).await;
                    tick += 1;

                    let dead = session_mgr.mark_dead_sessions(&session::is_tmux_session_alive);
                    let mut changed = !dead.is_empty();

                    // Every 60s (6 ticks), auto-clean stale DONE/ERROR sessions (>30 min old)
                    if tick.is_multiple_of(6) {
                        let stale =
                            session_mgr.stale_terminal_sessions(chrono::Duration::minutes(30));
                        for id in stale {
                            let _ = session_mgr.remove_session(&id);
                            changed = true;
                        }
                    }

                    // Kill sessions that have exceeded their cost budget
                    let over_budget: Vec<_> = session_mgr
                        .list_sessions()
                        .into_iter()
                        .filter(|s| s.cost_budget_usd > 0.0 && s.total_cost_usd > s.cost_budget_usd)
                        .collect();
                    for s in over_budget {
                        pty_mgr.detach(&s.id);
                        if let Some(ref wt_path) = s.worktree_path {
                            if wt_path.contains("/.worktrees/") {
                                if let Some(repo_path) =
                                    wt_path.rfind("/.worktrees/").map(|i| &wt_path[..i])
                                {
                                    let _ = git::remove_worktree(repo_path, wt_path);
                                }
                            }
                        }
                        let _ = session_mgr.kill_session(&s.id);
                        changed = true;
                    }

                    // Auto-respond: check WAITING sessions against configured patterns
                    // Debounce: only respond once per unique (session, preview) pair
                    let patterns = auto_respond::load_auto_responses();
                    if !patterns.is_empty() {
                        let waiting: Vec<_> = session_mgr
                            .list_sessions()
                            .into_iter()
                            .filter(|s| matches!(s.status, session::AgentStatus::WaitingForInput))
                            .collect();
                        // Remove entries for sessions no longer WAITING
                        let waiting_ids: std::collections::HashSet<_> =
                            waiting.iter().map(|s| s.id.clone()).collect();
                        last_auto_responded.retain(|id, _| waiting_ids.contains(id));

                        for s in waiting {
                            let already_responded = last_auto_responded
                                .get(&s.id)
                                .map(|prev| prev == &s.last_output_preview)
                                .unwrap_or(false);
                            if already_responded {
                                continue;
                            }

                            // Use last 500 chars of PTY output for richer pattern matching
                            let check_text = pty_mgr
                                .get_output(&s.id)
                                .map(|o| {
                                    let bytes = o.as_bytes();
                                    let start = bytes.len().saturating_sub(500);
                                    o[start..].to_string()
                                })
                                .unwrap_or_else(|| s.last_output_preview.clone());

                            if let Some(response) =
                                auto_respond::check_auto_respond(&check_text, &patterns)
                            {
                                let input = format!("{}\n", response);
                                let _ = pty_mgr.write_input(&s.id, &input);
                                last_auto_responded
                                    .insert(s.id.clone(), s.last_output_preview.clone());
                            }
                        }
                    }

                    // Stuck THINKING detection: if a THINKING session has had no
                    // output change for 15 minutes, send Ctrl+C to interrupt it.
                    let thinking_sessions: Vec<_> = session_mgr
                        .list_sessions()
                        .into_iter()
                        .filter(|s| matches!(s.status, session::AgentStatus::Thinking))
                        .collect();
                    let thinking_ids: Vec<String> =
                        thinking_sessions.iter().map(|s| s.id.clone()).collect();
                    stuck_detector.retain_only(&thinking_ids);
                    for s in &thinking_sessions {
                        let current_output = pty_mgr
                            .get_output(&s.id)
                            .map(|o| {
                                let bytes = o.as_bytes();
                                let start = bytes.len().saturating_sub(200);
                                o[start..].to_string()
                            })
                            .unwrap_or_default();
                        if stuck_detector.check(&s.id, &current_output) {
                            let _ = pty_mgr.write_input(&s.id, "\x03");
                            session_mgr.update_status(&s.id, session::AgentStatus::Idle);
                            let _ = tauri::Emitter::emit(&app_handle, "session-stuck", &s.id);
                            stuck_detector.reset(&s.id);
                            changed = true;
                        }
                    }

                    // Batch-done notification: fire when all active sessions finish.
                    // Only triggers if there were THINKING/WAITING sessions last tick.
                    {
                        let all_sessions = session_mgr.list_sessions();
                        let active_count = all_sessions
                            .iter()
                            .filter(|s| {
                                matches!(
                                    s.status,
                                    session::AgentStatus::Thinking
                                        | session::AgentStatus::WaitingForInput
                                )
                            })
                            .count();
                        if had_active_sessions && active_count == 0 && !all_sessions.is_empty() {
                            let done = all_sessions
                                .iter()
                                .filter(|s| matches!(s.status, session::AgentStatus::Done))
                                .count();
                            let errors = all_sessions
                                .iter()
                                .filter(|s| matches!(s.status, session::AgentStatus::Error))
                                .count();
                            let idle = all_sessions
                                .iter()
                                .filter(|s| matches!(s.status, session::AgentStatus::Idle))
                                .count();
                            let summary =
                                format!("{} done, {} failed, {} idle", done, errors, idle);
                            let _ = tauri::Emitter::emit(&app_handle, "batch-done", summary);
                        }
                        had_active_sessions = active_count > 0;
                    }

                    if changed {
                        let sessions: Vec<commands::SessionDto> = session_mgr
                            .list_sessions()
                            .into_iter()
                            .map(commands::SessionDto::from)
                            .collect();
                        let _ = tauri::Emitter::emit(&app_handle, "sessions-updated", sessions);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_session,
            commands::kill_session,
            commands::list_sessions,
            commands::send_input,
            commands::broadcast_input,
            commands::restore_sessions,
            commands::search_output,
            commands::resize_pty,
            commands::get_session_events,
            commands::export_session_output,
            commands::list_templates,
            commands::save_template,
            commands::delete_template,
            commands::fork_session,
            commands::rename_session,
            commands::set_session_note,
            commands::mark_session_done,
            commands::restart_session,
            commands::list_auto_responses,
            commands::add_auto_response,
            commands::delete_auto_response,
            commands::toggle_auto_response,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    #[test]
    fn smoke_test() {
        assert_eq!(1 + 1, 2);
    }
}
