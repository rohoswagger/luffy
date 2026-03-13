use std::collections::HashMap;
use std::process::Command;
use std::sync::{Arc, Mutex};
use anyhow::{anyhow, Result};
use super::model::{Session, AgentStatus, AgentType};
use super::events::SessionEvent;

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
                s.events.push(SessionEvent::cost_updated(cost));
            }
        }
    }

    /// Update the status of a session.
    pub fn update_status(&self, session_id: &str, status: AgentStatus) {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(s) = sessions.get_mut(session_id) {
            if s.status != status {
                let from = s.status.to_string();
                let to = status.to_string();
                s.events.push(SessionEvent::status_changed(&from, &to));
            }
            s.status = status;
            s.last_activity = chrono::Utc::now();
        }
    }

    /// Get events for a session.
    pub fn get_events(&self, session_id: &str) -> Vec<SessionEvent> {
        self.sessions.lock().unwrap()
            .get(session_id)
            .map(|s| s.events.clone())
            .unwrap_or_default()
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
                    events: vec![SessionEvent::created()],
                };
                sessions.insert(session.id.clone(), session.clone());
                restored.push(session);
            }
        }

        Ok(restored)
    }

    /// Return (name, agent_type, working_dir) for forking a session.
    pub fn get_fork_args(&self, session_id: &str) -> Option<(String, AgentType, Option<String>)> {
        self.sessions.lock().unwrap().get(session_id).map(|s| {
            let fork_name = format!("{}-fork", s.name);
            (fork_name, s.agent_type.clone(), s.worktree_path.clone())
        })
    }

    /// Check all active sessions against the provided alive check function.
    /// Sessions that are THINKING/WAITING/IDLE and not alive get marked ERROR.
    /// Returns the IDs of sessions that were marked as dead.
    pub fn mark_dead_sessions(&self, alive_check: &dyn Fn(&str) -> bool) -> Vec<String> {
        let to_check: Vec<(String, String)> = {
            let sessions = self.sessions.lock().unwrap();
            sessions.values()
                .filter(|s| matches!(s.status, AgentStatus::Thinking | AgentStatus::WaitingForInput | AgentStatus::Idle))
                .map(|s| (s.id.clone(), s.tmux_session.clone()))
                .collect()
        };

        let mut dead = vec![];
        for (id, tmux_name) in to_check {
            if !alive_check(&tmux_name) {
                self.update_status(&id, AgentStatus::Error);
                dead.push(id);
            }
        }
        dead
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

    #[test]
    fn get_fork_args_returns_fork_name_and_config() {
        let mgr = SessionManager::new();
        let mut s = Session::new("my-feature", AgentType::ClaudeCode);
        s.worktree_path = Some("/repo/worktree".to_string());
        let id = s.id.clone();
        mgr.sessions.lock().unwrap().insert(id.clone(), s);

        let args = mgr.get_fork_args(&id).unwrap();
        assert_eq!(args.0, "my-feature-fork");
        assert_eq!(args.1, AgentType::ClaudeCode);
        assert_eq!(args.2, Some("/repo/worktree".to_string()));
    }

    #[test]
    fn get_fork_args_returns_none_for_missing_session() {
        let mgr = SessionManager::new();
        assert!(mgr.get_fork_args("nonexistent").is_none());
    }

    #[test]
    fn mark_dead_sessions_all_alive_returns_empty() {
        let mgr = SessionManager::new();
        let s = Session::new("running", AgentType::Generic);
        let id = s.id.clone();
        mgr.sessions.lock().unwrap().insert(id.clone(), s);
        mgr.update_status(&id, AgentStatus::Thinking);

        let dead = mgr.mark_dead_sessions(&|_| true);
        assert!(dead.is_empty());
        assert_eq!(mgr.get_session(&id).unwrap().status, AgentStatus::Thinking);
    }

    #[test]
    fn mark_dead_sessions_dead_session_gets_error_status() {
        let mgr = SessionManager::new();
        let s = Session::new("zombie", AgentType::Generic);
        let id = s.id.clone();
        mgr.sessions.lock().unwrap().insert(id.clone(), s);
        mgr.update_status(&id, AgentStatus::Thinking);

        let dead = mgr.mark_dead_sessions(&|_| false);
        assert_eq!(dead, vec![id.clone()]);
        assert_eq!(mgr.get_session(&id).unwrap().status, AgentStatus::Error);
    }

    #[test]
    fn mark_dead_sessions_skips_terminal_states() {
        let mgr = SessionManager::new();
        let s1 = Session::new("done-session", AgentType::Generic);
        let s2 = Session::new("error-session", AgentType::Generic);
        let id1 = s1.id.clone();
        let id2 = s2.id.clone();
        mgr.sessions.lock().unwrap().insert(id1.clone(), s1);
        mgr.sessions.lock().unwrap().insert(id2.clone(), s2);
        mgr.update_status(&id1, AgentStatus::Done);
        mgr.update_status(&id2, AgentStatus::Error);

        // alive_check returns false for everything, but DONE/ERROR sessions should be skipped
        let dead = mgr.mark_dead_sessions(&|_| false);
        assert!(dead.is_empty());
        assert_eq!(mgr.get_session(&id1).unwrap().status, AgentStatus::Done);
        assert_eq!(mgr.get_session(&id2).unwrap().status, AgentStatus::Error);
    }

    #[test]
    fn mark_dead_sessions_only_marks_dead_ones() {
        let mgr = SessionManager::new();
        let alive = Session::new("alive", AgentType::Generic);
        let dead_s = Session::new("dead", AgentType::Generic);
        let alive_id = alive.id.clone();
        let dead_id = dead_s.id.clone();
        let alive_tmux = alive.tmux_session.clone();

        mgr.sessions.lock().unwrap().insert(alive_id.clone(), alive);
        mgr.sessions.lock().unwrap().insert(dead_id.clone(), dead_s);
        mgr.update_status(&alive_id, AgentStatus::WaitingForInput);
        mgr.update_status(&dead_id, AgentStatus::WaitingForInput);

        let dead = mgr.mark_dead_sessions(&|name| name == alive_tmux);
        assert_eq!(dead.len(), 1);
        assert_eq!(dead[0], dead_id);
        assert_eq!(mgr.get_session(&alive_id).unwrap().status, AgentStatus::WaitingForInput);
        assert_eq!(mgr.get_session(&dead_id).unwrap().status, AgentStatus::Error);
    }
}
