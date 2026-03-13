use crate::session::{AgentType, Session};
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize, Deserialize)]
pub struct CreateSessionArgs {
    pub name: String,
    pub agent_type: String,
    pub working_dir: Option<String>,
    pub startup_command: Option<String>,
    #[serde(default)]
    pub create_worktree: bool,
    #[serde(default)]
    pub cost_budget_usd: f64,
}

#[derive(Serialize, Clone)]
pub struct SessionDto {
    pub id: String,
    pub name: String,
    pub tmux_session: String,
    pub status: String,
    pub agent_type: String,
    pub worktree_path: Option<String>,
    pub branch: Option<String>,
    pub created_at: String,
    pub last_activity: String,
    pub total_cost_usd: f64,
    pub cost_budget_usd: f64,
    pub note: Option<String>,
    pub last_output_preview: String,
    pub startup_command: Option<String>,
}

impl From<Session> for SessionDto {
    fn from(s: Session) -> Self {
        SessionDto {
            id: s.id,
            name: s.name,
            tmux_session: s.tmux_session,
            status: s.status.to_string(),
            agent_type: match s.agent_type {
                AgentType::ClaudeCode => "claude-code".to_string(),
                AgentType::Aider => "aider".to_string(),
                AgentType::Generic => "generic".to_string(),
            },
            worktree_path: s.worktree_path,
            branch: s.branch,
            created_at: s.created_at.to_rfc3339(),
            last_activity: s.last_activity.to_rfc3339(),
            total_cost_usd: s.total_cost_usd,
            cost_budget_usd: s.cost_budget_usd,
            note: s.note,
            last_output_preview: s.last_output_preview,
            startup_command: s.startup_command,
        }
    }
}

fn parse_agent_type(s: &str) -> AgentType {
    match s {
        "claude-code" => AgentType::ClaudeCode,
        "aider" => AgentType::Aider,
        _ => AgentType::Generic,
    }
}

/// Attach PTY to a session, wiring status detection, cost tracking, and event emission.
fn attach_pty(
    pty_mgr: &crate::pty_stream::PtyManager,
    session_mgr: Arc<crate::session::SessionManager>,
    app: AppHandle,
    session_id: String,
    tmux_name: &str,
) -> Result<(), String> {
    let sid = session_id.clone();
    let app_clone = app.clone();

    pty_mgr
        .attach(session_id, tmux_name, move |chunk| {
            session_mgr.update_output_preview(&sid, &chunk);
            if let Some(new_status) = crate::status::detect_status(&chunk) {
                let prev = session_mgr.get_session(&sid).map(|s| s.status.clone());
                session_mgr.update_status(&sid, new_status.clone());
                if matches!(new_status, crate::session::AgentStatus::WaitingForInput)
                    && !matches!(prev, Some(crate::session::AgentStatus::WaitingForInput))
                {
                    let label = session_mgr
                        .get_session(&sid)
                        .map(|s| s.name.clone())
                        .unwrap_or_else(|| sid.clone());
                    let _ = app_clone.emit("agent-needs-input", label);
                }
            }
            if let Some(cost) = crate::cost::detect_cost(&chunk) {
                if session_mgr.update_cost(&sid, cost) {
                    let _ = app_clone.emit("cost-budget-exceeded", sid.clone());
                }
            }
            let _ = app_clone.emit(&format!("pty-output-{}", sid), chunk);
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_session(
    app: AppHandle,
    state: State<'_, AppState>,
    args: CreateSessionArgs,
) -> Result<SessionDto, String> {
    let agent_type = parse_agent_type(&args.agent_type);

    // Optionally create a git worktree for the session
    let effective_working_dir: Option<String> = if args.create_worktree {
        if let Some(ref base_dir) = args.working_dir {
            match crate::git::create_worktree(base_dir, &args.name) {
                Ok(wt_path) => Some(wt_path),
                Err(e) => {
                    eprintln!("Warning: could not create worktree: {}", e);
                    args.working_dir.clone()
                }
            }
        } else {
            None
        }
    } else {
        args.working_dir.clone()
    };

    let mut session = state
        .session_mgr
        .create_session(&args.name, agent_type, effective_working_dir.as_deref())
        .map_err(|e| e.to_string())?;

    if args.cost_budget_usd > 0.0 {
        state
            .session_mgr
            .set_cost_budget(&session.id, args.cost_budget_usd);
        session.cost_budget_usd = args.cost_budget_usd;
    }

    // Persist startup command so forks and restarts can replay it.
    if let Some(ref cmd) = args.startup_command {
        if !cmd.is_empty() {
            state
                .session_mgr
                .set_startup_command(&session.id, Some(cmd.clone()));
            session.startup_command = Some(cmd.clone());
        }
    }

    let session_id = session.id.clone();
    let tmux_name = session.tmux_session.clone();
    let dto = SessionDto::from(session);

    attach_pty(
        &state.pty_mgr,
        state.session_mgr.clone(),
        app.clone(),
        session_id.clone(),
        &tmux_name,
    )?;

    if let Some(cmd) = args.startup_command.as_deref() {
        if !cmd.is_empty() {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            let _ = state
                .pty_mgr
                .write_input(&session_id, &format!("{}\n", cmd));
        }
    }

    let sessions: Vec<SessionDto> = state
        .session_mgr
        .list_sessions()
        .into_iter()
        .map(SessionDto::from)
        .collect();
    let _ = app.emit("sessions-updated", sessions);

    Ok(dto)
}

#[tauri::command]
pub async fn kill_session(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    // If the session has a worktree under .worktrees/, clean it up
    if let Some(session) = state.session_mgr.get_session(&session_id) {
        if let Some(ref wt_path) = session.worktree_path {
            if wt_path.contains("/.worktrees/") {
                if let Some(repo_path) = wt_path.rfind("/.worktrees/").map(|i| &wt_path[..i]) {
                    let _ = crate::git::remove_worktree(repo_path, wt_path);
                }
            }
        }
    }

    state.pty_mgr.detach(&session_id);
    state
        .session_mgr
        .kill_session(&session_id)
        .map_err(|e| e.to_string())?;

    let sessions: Vec<SessionDto> = state
        .session_mgr
        .list_sessions()
        .into_iter()
        .map(SessionDto::from)
        .collect();
    let _ = app.emit("sessions-updated", sessions);

    Ok(())
}

#[tauri::command]
pub async fn list_sessions(state: State<'_, AppState>) -> Result<Vec<SessionDto>, String> {
    Ok(state
        .session_mgr
        .list_sessions()
        .into_iter()
        .map(SessionDto::from)
        .collect())
}

#[tauri::command]
pub async fn send_input(
    state: State<'_, AppState>,
    session_id: String,
    input: String,
) -> Result<(), String> {
    state
        .pty_mgr
        .write_input(&session_id, &input)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn restore_sessions(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<SessionDto>, String> {
    let sessions = state
        .session_mgr
        .restore_from_tmux()
        .map_err(|e| e.to_string())?;

    for session in &sessions {
        let _ = attach_pty(
            &state.pty_mgr,
            state.session_mgr.clone(),
            app.clone(),
            session.id.clone(),
            &session.tmux_session,
        );
    }

    Ok(sessions.into_iter().map(SessionDto::from).collect())
}

/// Rename a session's display name.
#[tauri::command]
pub async fn rename_session(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    new_name: String,
) -> Result<(), String> {
    if new_name.trim().is_empty() {
        return Err("Name cannot be empty".to_string());
    }
    if !state.session_mgr.rename_session(&session_id, &new_name) {
        return Err("Session not found".to_string());
    }
    let sessions: Vec<SessionDto> = state
        .session_mgr
        .list_sessions()
        .into_iter()
        .map(SessionDto::from)
        .collect();
    let _ = app.emit("sessions-updated", sessions);
    Ok(())
}

/// Set a freeform note on a session (empty string clears it).
#[tauri::command]
pub async fn set_session_note(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    note: String,
) -> Result<(), String> {
    if !state.session_mgr.set_session_note(&session_id, &note) {
        return Err("Session not found".to_string());
    }
    let sessions: Vec<SessionDto> = state
        .session_mgr
        .list_sessions()
        .into_iter()
        .map(SessionDto::from)
        .collect();
    let _ = app.emit("sessions-updated", sessions);
    Ok(())
}

/// Fork an existing session: create a new session with the same agent type, working dir, and startup command.
#[tauri::command]
pub async fn fork_session(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
) -> Result<SessionDto, String> {
    let (name, agent_type, working_dir, startup_command) = state
        .session_mgr
        .get_fork_args(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;

    let mut session = state
        .session_mgr
        .create_session(&name, agent_type, working_dir.as_deref())
        .map_err(|e| e.to_string())?;

    if let Some(ref cmd) = startup_command {
        if !cmd.is_empty() {
            state
                .session_mgr
                .set_startup_command(&session.id, Some(cmd.clone()));
            session.startup_command = Some(cmd.clone());
        }
    }

    let session_id_new = session.id.clone();
    let tmux_name = session.tmux_session.clone();
    let dto = SessionDto::from(session);

    attach_pty(
        &state.pty_mgr,
        state.session_mgr.clone(),
        app.clone(),
        session_id_new.clone(),
        &tmux_name,
    )?;

    if let Some(ref cmd) = startup_command {
        if !cmd.is_empty() {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            let _ = state
                .pty_mgr
                .write_input(&session_id_new, &format!("{}\n", cmd));
        }
    }

    let sessions: Vec<SessionDto> = state
        .session_mgr
        .list_sessions()
        .into_iter()
        .map(SessionDto::from)
        .collect();
    let _ = app.emit("sessions-updated", sessions);

    Ok(dto)
}

// ---- Session Templates ----

#[tauri::command]
pub async fn list_templates() -> Result<Vec<crate::templates::SessionTemplate>, String> {
    crate::templates::load_templates().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_template(
    name: String,
    agent_type: String,
    working_dir: Option<String>,
    count: u32,
    startup_command: Option<String>,
    cost_budget_usd: Option<f64>,
) -> Result<Vec<crate::templates::SessionTemplate>, String> {
    let t = crate::templates::SessionTemplate::new(
        &name,
        &agent_type,
        working_dir,
        count,
        startup_command,
        cost_budget_usd.unwrap_or(0.0),
    );
    crate::templates::add_template(t).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_template(
    template_id: String,
) -> Result<Vec<crate::templates::SessionTemplate>, String> {
    crate::templates::delete_template(&template_id).map_err(|e| e.to_string())
}

// ---- Auto-Response Patterns ----

#[tauri::command]
pub async fn list_auto_responses() -> Result<Vec<crate::auto_respond::AutoResponse>, String> {
    Ok(crate::auto_respond::load_auto_responses())
}

#[tauri::command]
pub async fn add_auto_response(
    pattern: String,
    response: String,
) -> Result<Vec<crate::auto_respond::AutoResponse>, String> {
    let ar = crate::auto_respond::AutoResponse::new(&pattern, &response);
    crate::auto_respond::add_auto_response(ar).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_auto_response(
    id: String,
) -> Result<Vec<crate::auto_respond::AutoResponse>, String> {
    crate::auto_respond::delete_auto_response(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_auto_response(
    id: String,
    enabled: bool,
) -> Result<Vec<crate::auto_respond::AutoResponse>, String> {
    crate::auto_respond::toggle_auto_response(&id, enabled).map_err(|e| e.to_string())
}

/// Export a session's output buffer to a log file in ~/Downloads (or ~).
/// Returns the full path of the written file.
#[tauri::command]
pub async fn export_session_output(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<String, String> {
    let session = state
        .session_mgr
        .get_session(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;

    let output = state
        .pty_mgr
        .get_output(&session_id)
        .unwrap_or_else(|| format!("# No output captured for session '{}'.\n", session.name));

    let safe_name = session.name.replace(['/', '\\', ':', ' '], "-");
    let timestamp = chrono::Utc::now().format("%Y%m%d-%H%M%S");
    let filename = format!("luffy-{}-{}.log", safe_name, timestamp);

    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let downloads = std::path::PathBuf::from(&home).join("Downloads");
    let dir = if downloads.exists() {
        downloads
    } else {
        std::path::PathBuf::from(&home)
    };
    let path = dir.join(&filename);

    std::fs::write(&path, &output).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Return the event log for a session.
#[tauri::command]
pub async fn get_session_events(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Vec<crate::session::SessionEvent>, String> {
    Ok(state.session_mgr.get_events(&session_id))
}

/// Manually mark a session as Done.
#[tauri::command]
pub async fn mark_session_done(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    state
        .session_mgr
        .update_status(&session_id, crate::session::AgentStatus::Done);
    let sessions: Vec<SessionDto> = state
        .session_mgr
        .list_sessions()
        .into_iter()
        .map(SessionDto::from)
        .collect();
    let _ = app.emit("sessions-updated", sessions);
    Ok(())
}

/// Restart a session: kill it and create a new one with the same config.
/// Returns the new SessionDto. Useful when a session crashes (ERROR status).
#[tauri::command]
pub async fn restart_session(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
) -> Result<SessionDto, String> {
    let (name, agent_type, working_dir, startup_command, cost_budget) = state
        .session_mgr
        .get_restart_args(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;

    // Kill the old session (ignore error if already dead)
    state.pty_mgr.detach(&session_id);
    let _ = state.session_mgr.kill_session(&session_id);

    // Create a new session with the same config
    let mut session = state
        .session_mgr
        .create_session(&name, agent_type, working_dir.as_deref())
        .map_err(|e| e.to_string())?;

    if cost_budget > 0.0 {
        state.session_mgr.set_cost_budget(&session.id, cost_budget);
        session.cost_budget_usd = cost_budget;
    }

    if let Some(ref cmd) = startup_command {
        if !cmd.is_empty() {
            state
                .session_mgr
                .set_startup_command(&session.id, Some(cmd.clone()));
            session.startup_command = Some(cmd.clone());
        }
    }

    let session_id_new = session.id.clone();
    let tmux_name = session.tmux_session.clone();
    let dto = SessionDto::from(session);

    attach_pty(
        &state.pty_mgr,
        state.session_mgr.clone(),
        app.clone(),
        session_id_new.clone(),
        &tmux_name,
    )?;

    if let Some(ref cmd) = startup_command {
        if !cmd.is_empty() {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            let _ = state
                .pty_mgr
                .write_input(&session_id_new, &format!("{}\n", cmd));
        }
    }

    let sessions: Vec<SessionDto> = state
        .session_mgr
        .list_sessions()
        .into_iter()
        .map(SessionDto::from)
        .collect();
    let _ = app.emit("sessions-updated", sessions);

    Ok(dto)
}

/// Resize a session's PTY to match the frontend terminal dimensions.
#[tauri::command]
pub async fn resize_pty(
    state: State<'_, AppState>,
    session_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    state.pty_mgr.resize(&session_id, rows, cols);
    Ok(())
}

/// Return the stored (ANSI-stripped) output buffer for a session.
/// Used by the frontend to replay history when re-mounting a TerminalPane.
#[tauri::command]
pub async fn get_pty_output(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<String, String> {
    Ok(state.pty_mgr.get_output(&session_id).unwrap_or_default())
}

/// Search ANSI-stripped output buffers across all sessions.
#[derive(Serialize, Clone)]
pub struct SearchResult {
    pub session_id: String,
    pub session_name: String,
    pub line_number: usize,
    pub excerpt: String,
}

#[tauri::command]
pub async fn search_output(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<SearchResult>, String> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }
    let q = query.to_lowercase();
    let sessions = state.session_mgr.list_sessions();
    let mut results = vec![];
    for session in sessions {
        if let Some(output) = state.pty_mgr.get_output(&session.id) {
            for (i, line) in output.lines().enumerate() {
                if line.to_lowercase().contains(&q) {
                    results.push(SearchResult {
                        session_id: session.id.clone(),
                        session_name: session.name.clone(),
                        line_number: i + 1,
                        excerpt: line.chars().take(200).collect(),
                    });
                }
            }
        }
    }
    Ok(results)
}

/// Send the same input to all active sessions simultaneously.
#[tauri::command]
pub async fn broadcast_input(
    state: State<'_, AppState>,
    input: String,
) -> Result<Vec<String>, String> {
    let sessions = state.session_mgr.list_sessions();
    let mut errors = vec![];
    for session in &sessions {
        if let Err(e) = state.pty_mgr.write_input(&session.id, &input) {
            errors.push(format!("{}: {}", session.name, e));
        }
    }
    Ok(errors) // returns list of session names that failed (empty = all succeeded)
}
