pub mod session;
pub mod status;
pub mod commands;
pub mod pty_stream;
pub mod git;
pub mod templates;
pub mod cost;

use session::SessionManager;
use pty_stream::PtyManager;
use std::sync::Arc;
use tauri::Manager;

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
            let app_handle = app.handle().clone();
            let state = app.state::<AppState>();
            let session_mgr = state.session_mgr.clone();

            // Background health monitor: every 10s, check if tmux sessions are still alive
            // and auto-remove DONE/ERROR sessions older than 30 minutes.
            tauri::async_runtime::spawn(async move {
                let mut tick = 0u32;
                loop {
                    tokio::time::sleep(std::time::Duration::from_secs(10)).await;
                    tick += 1;

                    let dead = session_mgr.mark_dead_sessions(&session::is_tmux_session_alive);
                    let mut changed = !dead.is_empty();

                    // Every 60s (6 ticks), auto-clean stale DONE/ERROR sessions (>30 min old)
                    if tick % 6 == 0 {
                        let stale = session_mgr.stale_terminal_sessions(chrono::Duration::minutes(30));
                        for id in stale {
                            let _ = session_mgr.remove_session(&id);
                            changed = true;
                        }
                    }

                    if changed {
                        let sessions: Vec<commands::SessionDto> = session_mgr.list_sessions()
                            .into_iter().map(commands::SessionDto::from).collect();
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
