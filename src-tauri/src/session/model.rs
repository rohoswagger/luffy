use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AgentStatus {
    Thinking,
    WaitingForInput,
    Idle,
    Error,
    Done,
}

impl Default for AgentStatus {
    fn default() -> Self { AgentStatus::Idle }
}

impl std::fmt::Display for AgentStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AgentStatus::Thinking => write!(f, "THINKING"),
            AgentStatus::WaitingForInput => write!(f, "WAITING"),
            AgentStatus::Idle => write!(f, "IDLE"),
            AgentStatus::Error => write!(f, "ERROR"),
            AgentStatus::Done => write!(f, "DONE"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AgentType {
    ClaudeCode,
    Aider,
    Generic,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub name: String,
    pub tmux_session: String,
    pub created_at: DateTime<Utc>,
    pub status: AgentStatus,
    pub last_activity: DateTime<Utc>,
    pub worktree_path: Option<String>,
    pub branch: Option<String>,
    pub agent_type: AgentType,
    pub total_cost_usd: f64,
}

impl Session {
    pub fn new(name: &str, agent_type: AgentType) -> Self {
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();
        Session {
            tmux_session: format!("luffy-{}", &id[..8]),
            id,
            name: name.to_string(),
            created_at: now,
            status: AgentStatus::default(),
            last_activity: now,
            worktree_path: None,
            branch: None,
            agent_type,
            total_cost_usd: 0.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_session_has_idle_status() {
        let s = Session::new("test", AgentType::ClaudeCode);
        assert_eq!(s.status, AgentStatus::Idle);
        assert_eq!(s.name, "test");
        assert!(!s.id.is_empty());
        assert!(s.tmux_session.starts_with("luffy-"));
    }

    #[test]
    fn agent_status_display() {
        assert_eq!(AgentStatus::Thinking.to_string(), "THINKING");
        assert_eq!(AgentStatus::WaitingForInput.to_string(), "WAITING");
        assert_eq!(AgentStatus::Error.to_string(), "ERROR");
    }
}
