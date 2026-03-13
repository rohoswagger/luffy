use std::collections::HashMap;
use std::process::Command;
use std::sync::{Arc, Mutex};
use anyhow::{anyhow, Result};
use super::model::{Session, AgentStatus, AgentType};

#[derive(Clone)]
pub struct SessionManager {
    sessions: Arc<Mutex<HashMap<String, Session>>>,
}

impl SessionManager {
    pub fn new() -> Self {
        SessionManager {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Create a new tmux session and register it.
    pub fn create_session(&self, name: &str, agent_type: AgentType, working_dir: Option<&str>) -> Result<Session> {
        let mut session = Session::new(name, agent_type);

        if let Some(dir) = working_dir {
            let (branch, worktree) = crate::git::detect_git_info(dir);
            session.branch = branch;
            session.worktree_path = worktree;
        }

        let tmux_name = &session.tmux_session;

        let mut cmd = Command::new("tmux");
        cmd.args(["new-session", "-d", "-s", tmux_name]);

        if let Some(dir) = working_dir {
            cmd.args(["-c", dir]);
        }

        let output = cmd.output()?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("tmux new-session failed: {}", stderr));
        }

        let mut sessions = self.sessions.lock().unwrap();
        sessions.insert(session.id.clone(), session.clone());
        Ok(session)
    }

    /// Kill a tmux session by session ID.
    pub fn kill_session(&self, session_id: &str) -> Result<()> {
        let tmux_name = {
            let sessions = self.sessions.lock().unwrap();
            sessions.get(session_id)
                .map(|s| s.tmux_session.clone())
                .ok_or_else(|| anyhow!("Session not found: {}", session_id))?
        };

        let output = Command::new("tmux")
            .args(["kill-session", "-t", &tmux_name])
            .output()?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("tmux kill-session failed: {}", stderr));
        }

        self.sessions.lock().unwrap().remove(session_id);
        Ok(())
    }

    /// List all sessions managed by Luffy.
    pub fn list_sessions(&self) -> Vec<Session> {
        self.sessions.lock().unwrap().values().cloned().collect()
    }

    /// Get a single session by ID.
    pub fn get_session(&self, session_id: &str) -> Option<Session> {
        self.sessions.lock().unwrap().get(session_id).cloned()
    }

    /// Update the running cost of a session (stores the maximum seen so far).
    pub fn update_cost(&self, session_id: &str, cost: f64) {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(s) = sessions.get_mut(session_id) {
            if cost > s.total_cost_usd {
                s.total_cost_usd = cost;
            }
        }
    }

    /// Update the status of a session.
    pub fn update_status(&self, session_id: &str, status: AgentStatus) {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(s) = sessions.get_mut(session_id) {
            s.status = status;
            s.last_activity = chrono::Utc::now();
        }
    }

    /// Load existing luffy-managed tmux sessions (for app restart persistence).
    pub fn restore_from_tmux(&self) -> Result<Vec<Session>> {
        let output = Command::new("tmux")
            .args(["list-sessions", "-F", "#{session_name}"])
            .output();

        let output = match output {
            Ok(o) => o,
            Err(_) => return Ok(vec![]),
        };

        if !output.status.success() {
            return Ok(vec![]);
        }

        let names = String::from_utf8_lossy(&output.stdout);
        let mut restored = vec![];
        let mut sessions = self.sessions.lock().unwrap();

        for line in names.lines() {
            let name = line.trim();
            if name.starts_with("luffy-") {
                let display_name = name.strip_prefix("luffy-").unwrap_or(name);
                let session = Session {
                    id: uuid::Uuid::new_v4().to_string(),
                    name: display_name.to_string(),
                    tmux_session: name.to_string(),
                    created_at: chrono::Utc::now(),
                    status: AgentStatus::Idle,
                    last_activity: chrono::Utc::now(),
                    worktree_path: None,
                    branch: None,
                    agent_type: AgentType::Generic,
                    total_cost_usd: 0.0,
                };
                sessions.insert(session.id.clone(), session.clone());
                restored.push(session);
            }
        }

        Ok(restored)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_manager_has_empty_sessions() {
        let mgr = SessionManager::new();
        assert_eq!(mgr.list_sessions().len(), 0);
    }

    #[test]
    fn update_status_changes_session_status() {
        let mgr = SessionManager::new();
        let session = Session::new("test", AgentType::ClaudeCode);
        let id = session.id.clone();
        mgr.sessions.lock().unwrap().insert(id.clone(), session);

        mgr.update_status(&id, AgentStatus::Thinking);
        let s = mgr.get_session(&id).unwrap();
        assert_eq!(s.status, AgentStatus::Thinking);
    }

    #[test]
    fn get_nonexistent_session_returns_none() {
        let mgr = SessionManager::new();
        assert!(mgr.get_session("nonexistent").is_none());
    }

    #[test]
    fn list_sessions_returns_all() {
        let mgr = SessionManager::new();
        for i in 0..3 {
            let s = Session::new(&format!("session-{}", i), AgentType::Generic);
            let id = s.id.clone();
            mgr.sessions.lock().unwrap().insert(id, s);
        }
        assert_eq!(mgr.list_sessions().len(), 3);
    }
}
