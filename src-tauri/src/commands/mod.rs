use tauri::{AppHandle, Emitter, State};
use crate::session::{AgentType, Session};
use crate::AppState;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct CreateSessionArgs {
    pub name: String,
    pub agent_type: String,
    pub working_dir: Option<String>,
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

#[tauri::command]
pub async fn create_session(
    app: AppHandle,
    state: State<'_, AppState>,
    args: CreateSessionArgs,
) -> Result<SessionDto, String> {
    let agent_type = parse_agent_type(&args.agent_type);
    let session = state.session_mgr
        .create_session(&args.name, agent_type, args.working_dir.as_deref())
        .map_err(|e| e.to_string())?;

    let session_id = session.id.clone();
    let tmux_name = session.tmux_session.clone();
    let dto = SessionDto::from(session);

    let app_clone = app.clone();
    let sid = session_id.clone();
    let session_mgr_clone = state.session_mgr.clone();

    state.pty_mgr.attach(session_id.clone(), &tmux_name, move |chunk| {
        if let Some(new_status) = crate::status::detect_status(&chunk) {
            let prev = session_mgr_clone.get_session(&sid).map(|s| s.status.clone());
            session_mgr_clone.update_status(&sid, new_status.clone());
            if matches!(new_status, crate::session::AgentStatus::WaitingForInput)
                && !matches!(prev, Some(crate::session::AgentStatus::WaitingForInput))
            {
                let label = session_mgr_clone.get_session(&sid)
                    .map(|s| s.name.clone())
                    .unwrap_or_else(|| sid.clone());
                let _ = app_clone.emit("agent-needs-input", label);
            }
        }
        let _ = app_clone.emit(&format!("pty-output-{}", sid), chunk);
    }).map_err(|e| e.to_string())?;

    let sessions: Vec<SessionDto> = state.session_mgr.list_sessions()
        .into_iter().map(SessionDto::from).collect();
    let _ = app.emit("sessions-updated", sessions);

    Ok(dto)
}

#[tauri::command]
pub async fn kill_session(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    state.pty_mgr.detach(&session_id);
    state.session_mgr.kill_session(&session_id).map_err(|e| e.to_string())?;

    let sessions: Vec<SessionDto> = state.session_mgr.list_sessions()
        .into_iter().map(SessionDto::from).collect();
    let _ = app.emit("sessions-updated", sessions);

    Ok(())
}

#[tauri::command]
pub async fn list_sessions(
    state: State<'_, AppState>,
) -> Result<Vec<SessionDto>, String> {
    Ok(state.session_mgr.list_sessions()
        .into_iter().map(SessionDto::from).collect())
}

#[tauri::command]
pub async fn send_input(
    state: State<'_, AppState>,
    session_id: String,
    input: String,
) -> Result<(), String> {
    state.pty_mgr.write_input(&session_id, &input).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn restore_sessions(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<SessionDto>, String> {
    let sessions = state.session_mgr.restore_from_tmux().map_err(|e| e.to_string())?;

    for session in &sessions {
        let session_id = session.id.clone();
        let tmux_name = session.tmux_session.clone();
        let app_clone = app.clone();
        let sid = session_id.clone();
        let session_mgr_clone = state.session_mgr.clone();

        let _ = state.pty_mgr.attach(session_id, &tmux_name, move |chunk| {
            if let Some(new_status) = crate::status::detect_status(&chunk) {
                let prev = session_mgr_clone.get_session(&sid).map(|s| s.status.clone());
                session_mgr_clone.update_status(&sid, new_status.clone());
                if matches!(new_status, crate::session::AgentStatus::WaitingForInput)
                    && !matches!(prev, Some(crate::session::AgentStatus::WaitingForInput))
                {
                    let label = session_mgr_clone.get_session(&sid)
                        .map(|s| s.name.clone())
                        .unwrap_or_else(|| sid.clone());
                    let _ = app_clone.emit("agent-needs-input", label);
                }
            }
            let _ = app_clone.emit(&format!("pty-output-{}", sid), chunk);
        });
    }

    Ok(sessions.into_iter().map(SessionDto::from).collect())
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
