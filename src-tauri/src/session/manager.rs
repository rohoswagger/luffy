use super::events::SessionEvent;
use super::model::{AgentStatus, AgentType, Session};
use anyhow::{anyhow, Result};
use std::collections::HashMap;
use std::process::Command;
use std::sync::{Arc, Mutex};

#[derive(Clone, Default)]
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
    pub fn create_session(
        &self,
        name: &str,
        agent_type: AgentType,
        working_dir: Option<&str>,
    ) -> Result<Session> {
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

        {
            let mut sessions = self.sessions.lock().unwrap();
            sessions.insert(session.id.clone(), session.clone());
        }
        self.persist_meta();
        Ok(session)
    }

    /// Save current session metadata to disk for persistence across restarts.
    fn persist_meta(&self) {
        let sessions: Vec<crate::session_meta::SessionMeta> = self
            .sessions
            .lock()
            .unwrap()
            .values()
            .map(|s| crate::session_meta::SessionMeta {
                tmux_session: s.tmux_session.clone(),
                name: s.name.clone(),
                agent_type: match s.agent_type {
                    AgentType::ClaudeCode => "claude-code".to_string(),
                    AgentType::Aider => "aider".to_string(),
                    AgentType::Generic => "generic".to_string(),
                },
                working_dir: s.worktree_path.clone(),
                note: s.note.clone(),
                cost_budget_usd: s.cost_budget_usd,
            })
            .collect();
        let _ = crate::session_meta::save_meta(&sessions);
    }

    /// Kill a tmux session by session ID.
    pub fn kill_session(&self, session_id: &str) -> Result<()> {
        let tmux_name = {
            let sessions = self.sessions.lock().unwrap();
            sessions
                .get(session_id)
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
        self.persist_meta();
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

    /// Set the cost budget for a session (0.0 = no limit).
    pub fn set_cost_budget(&self, session_id: &str, budget: f64) {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(s) = sessions.get_mut(session_id) {
            s.cost_budget_usd = budget;
        }
    }

    /// Update the running cost of a session (stores the maximum seen so far).
    /// Returns true if the session has a budget set and the new cost exceeds it.
    pub fn update_cost(&self, session_id: &str, cost: f64) -> bool {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(s) = sessions.get_mut(session_id) {
            if cost > s.total_cost_usd {
                s.total_cost_usd = cost;
                s.events.push(SessionEvent::cost_updated(cost));
                return s.cost_budget_usd > 0.0 && cost > s.cost_budget_usd;
            }
        }
        false
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
        self.sessions
            .lock()
            .unwrap()
            .get(session_id)
            .map(|s| s.events.clone())
            .unwrap_or_default()
    }

    /// Load existing luffy-managed tmux sessions (for app restart persistence).
    /// Uses persisted metadata to restore agent type and other config.
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

        // Load persisted metadata for agent type lookup
        let meta_map: std::collections::HashMap<String, crate::session_meta::SessionMeta> =
            crate::session_meta::load_meta()
                .into_iter()
                .map(|m| (m.tmux_session.clone(), m))
                .collect();

        let names = String::from_utf8_lossy(&output.stdout);
        let mut restored = vec![];
        let mut sessions = self.sessions.lock().unwrap();

        for line in names.lines() {
            let name = line.trim();
            if name.starts_with("luffy-") {
                let meta = meta_map.get(name);
                let display_name = meta
                    .map(|m| m.name.as_str())
                    .unwrap_or_else(|| name.strip_prefix("luffy-").unwrap_or(name));
                let agent_type = meta
                    .map(|m| match m.agent_type.as_str() {
                        "claude-code" => AgentType::ClaudeCode,
                        "aider" => AgentType::Aider,
                        _ => AgentType::Generic,
                    })
                    .unwrap_or(AgentType::Generic);
                let working_dir = meta.and_then(|m| m.working_dir.clone());
                let note = meta.and_then(|m| m.note.clone());
                let cost_budget_usd = meta.map(|m| m.cost_budget_usd).unwrap_or(0.0);
                let (branch, worktree) = working_dir
                    .as_deref()
                    .map(crate::git::detect_git_info)
                    .unwrap_or((None, None));

                let session = Session {
                    id: uuid::Uuid::new_v4().to_string(),
                    name: display_name.to_string(),
                    tmux_session: name.to_string(),
                    created_at: chrono::Utc::now(),
                    status: AgentStatus::Idle,
                    last_activity: chrono::Utc::now(),
                    worktree_path: worktree,
                    branch,
                    agent_type,
                    total_cost_usd: 0.0,
                    cost_budget_usd,
                    note,
                    last_output_preview: String::new(),
                    events: vec![SessionEvent::created()],
                };
                sessions.insert(session.id.clone(), session.clone());
                restored.push(session);
            }
        }

        Ok(restored)
    }

    /// Rename a session (display name only, tmux session name unchanged).
    pub fn rename_session(&self, session_id: &str, new_name: &str) -> bool {
        let renamed = {
            let mut sessions = self.sessions.lock().unwrap();
            if let Some(s) = sessions.get_mut(session_id) {
                s.name = new_name.trim().to_string();
                true
            } else {
                false
            }
        };
        if renamed {
            self.persist_meta();
        }
        renamed
    }

    /// Set or clear a freeform note on a session.
    pub fn set_session_note(&self, session_id: &str, note: &str) -> bool {
        let updated = {
            let mut sessions = self.sessions.lock().unwrap();
            if let Some(s) = sessions.get_mut(session_id) {
                s.note = if note.is_empty() {
                    None
                } else {
                    Some(note.to_string())
                };
                true
            } else {
                false
            }
        };
        if updated {
            self.persist_meta();
        }
        updated
    }

    /// Remove a session from the registry without killing the tmux session.
    /// Used for cleanup of already-dead or already-finished sessions.
    pub fn remove_session(&self, session_id: &str) -> bool {
        self.sessions.lock().unwrap().remove(session_id).is_some()
    }

    /// Return IDs of DONE/ERROR sessions whose last_activity is older than `max_age`.
    pub fn stale_terminal_sessions(&self, max_age: chrono::Duration) -> Vec<String> {
        let cutoff = chrono::Utc::now() - max_age;
        self.sessions
            .lock()
            .unwrap()
            .values()
            .filter(|s| matches!(s.status, AgentStatus::Done | AgentStatus::Error))
            .filter(|s| s.last_activity < cutoff)
            .map(|s| s.id.clone())
            .collect()
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
            sessions
                .values()
                .filter(|s| {
                    matches!(
                        s.status,
                        AgentStatus::Thinking | AgentStatus::WaitingForInput | AgentStatus::Idle
                    )
                })
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

    /// Update the last output preview for a session (ANSI-stripped last meaningful line).
    pub fn update_output_preview(&self, session_id: &str, raw_chunk: &str) {
        let preview = extract_preview(raw_chunk);
        if preview.is_empty() {
            return;
        }
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(s) = sessions.get_mut(session_id) {
            s.last_output_preview = preview;
        }
    }
}

/// Strip ANSI escape codes and return the last non-empty line, truncated to 80 chars.
pub fn extract_preview(raw: &str) -> String {
    // Remove ANSI/VT escape sequences (CSI sequences including private mode params) and carriage returns
    let ansi_re = regex::Regex::new(r"\x1b\[[0-9;?]*[A-Za-z]|\x1b[A-Za-z]|\r").unwrap();
    let clean = ansi_re.replace_all(raw, "");
    clean
        .lines()
        .map(|l| l.trim())
        .rfind(|l| !l.is_empty())
        .map(|l| if l.len() > 80 { &l[..80] } else { l })
        .unwrap_or("")
        .to_string()
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
    fn rename_session_changes_display_name() {
        let mgr = SessionManager::new();
        let s = Session::new("old-name", AgentType::Generic);
        let id = s.id.clone();
        mgr.sessions.lock().unwrap().insert(id.clone(), s);

        assert!(mgr.rename_session(&id, "new-name"));
        assert_eq!(mgr.get_session(&id).unwrap().name, "new-name");
    }

    #[test]
    fn rename_session_trims_whitespace() {
        let mgr = SessionManager::new();
        let s = Session::new("foo", AgentType::Generic);
        let id = s.id.clone();
        mgr.sessions.lock().unwrap().insert(id.clone(), s);

        mgr.rename_session(&id, "  bar  ");
        assert_eq!(mgr.get_session(&id).unwrap().name, "bar");
    }

    #[test]
    fn rename_session_returns_false_for_missing_session() {
        let mgr = SessionManager::new();
        assert!(!mgr.rename_session("nope", "new-name"));
    }

    #[test]
    fn stale_terminal_sessions_returns_ids_past_threshold() {
        let mgr = SessionManager::new();
        // Insert old DONE session directly with backdated last_activity
        let mut old_done = Session::new("old-done", AgentType::Generic);
        old_done.status = AgentStatus::Done;
        old_done.last_activity = chrono::Utc::now() - chrono::Duration::hours(2);
        let id_old = old_done.id.clone();
        mgr.sessions
            .lock()
            .unwrap()
            .insert(id_old.clone(), old_done);

        // Insert recent DONE session (just now)
        let mut recent_done = Session::new("recent-done", AgentType::Generic);
        recent_done.status = AgentStatus::Done;
        let id_recent = recent_done.id.clone();
        mgr.sessions
            .lock()
            .unwrap()
            .insert(id_recent.clone(), recent_done);

        let stale = mgr.stale_terminal_sessions(chrono::Duration::hours(1));
        assert_eq!(stale.len(), 1);
        assert_eq!(stale[0], id_old);
    }

    #[test]
    fn stale_terminal_sessions_skips_active_states() {
        let mgr = SessionManager::new();
        // Active session with old last_activity should NOT be stale
        let mut old_thinking = Session::new("old-thinking", AgentType::Generic);
        old_thinking.status = AgentStatus::Thinking;
        old_thinking.last_activity = chrono::Utc::now() - chrono::Duration::hours(2);
        let id = old_thinking.id.clone();
        mgr.sessions
            .lock()
            .unwrap()
            .insert(id.clone(), old_thinking);

        let stale = mgr.stale_terminal_sessions(chrono::Duration::hours(1));
        assert!(stale.is_empty());
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
        assert_eq!(
            mgr.get_session(&alive_id).unwrap().status,
            AgentStatus::WaitingForInput
        );
        assert_eq!(
            mgr.get_session(&dead_id).unwrap().status,
            AgentStatus::Error
        );
    }

    #[test]
    fn update_cost_returns_budget_exceeded_when_cost_crosses_limit() {
        let mgr = SessionManager::new();
        let mut s = Session::new("expensive", AgentType::Generic);
        s.cost_budget_usd = 5.0;
        let id = s.id.clone();
        mgr.sessions.lock().unwrap().insert(id.clone(), s);

        let exceeded = mgr.update_cost(&id, 6.0);
        assert!(exceeded, "Expected budget exceeded");
    }

    #[test]
    fn update_cost_returns_false_when_within_budget() {
        let mgr = SessionManager::new();
        let mut s = Session::new("cheap", AgentType::Generic);
        s.cost_budget_usd = 10.0;
        let id = s.id.clone();
        mgr.sessions.lock().unwrap().insert(id.clone(), s);

        let exceeded = mgr.update_cost(&id, 2.0);
        assert!(!exceeded);
    }

    #[test]
    fn update_cost_returns_false_when_no_budget_set() {
        let mgr = SessionManager::new();
        let s = Session::new("default-budget", AgentType::Generic);
        let id = s.id.clone();
        mgr.sessions.lock().unwrap().insert(id.clone(), s);

        let exceeded = mgr.update_cost(&id, 100.0);
        assert!(!exceeded, "No budget = never exceeded");
    }

    #[test]
    fn extract_preview_strips_ansi_and_returns_last_nonempty_line() {
        let raw = "\x1b[32mAll tests passed!\x1b[0m\n\n";
        assert_eq!(extract_preview(raw), "All tests passed!");
    }

    #[test]
    fn extract_preview_returns_empty_for_blank_output() {
        assert_eq!(extract_preview("\n\n  \n"), "");
    }

    #[test]
    fn extract_preview_truncates_long_lines() {
        let long_line = "x".repeat(120);
        let preview = extract_preview(&long_line);
        assert!(preview.len() <= 80);
    }

    #[test]
    fn update_output_preview_stores_last_meaningful_line() {
        let mgr = SessionManager::new();
        let s = Session::new("my-session", AgentType::Generic);
        let id = s.id.clone();
        mgr.sessions.lock().unwrap().insert(id.clone(), s);

        mgr.update_output_preview(&id, "\x1b[1mRunning tests...\x1b[0m\n");
        assert_eq!(
            mgr.get_session(&id).unwrap().last_output_preview,
            "Running tests..."
        );
    }

    #[test]
    fn set_session_note_persists_note() {
        let mgr = SessionManager::new();
        let s = Session::new("my-session", AgentType::Generic);
        let id = s.id.clone();
        mgr.sessions.lock().unwrap().insert(id.clone(), s);

        assert!(mgr.set_session_note(&id, "working on auth refactor"));
        assert_eq!(
            mgr.get_session(&id).unwrap().note.as_deref(),
            Some("working on auth refactor")
        );
    }

    #[test]
    fn set_session_note_returns_false_for_missing_session() {
        let mgr = SessionManager::new();
        assert!(!mgr.set_session_note("nonexistent", "note"));
    }

    #[test]
    fn set_session_note_empty_clears_note() {
        let mgr = SessionManager::new();
        let s = Session::new("my-session", AgentType::Generic);
        let id = s.id.clone();
        mgr.sessions.lock().unwrap().insert(id.clone(), s);

        mgr.set_session_note(&id, "some note");
        mgr.set_session_note(&id, "");
        assert!(mgr.get_session(&id).unwrap().note.is_none());
    }
}
