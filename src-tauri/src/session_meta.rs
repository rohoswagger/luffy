use anyhow::Result;
/// Persists lightweight session metadata to survive app restarts.
/// This complements tmux session persistence with agent type, working dir, etc.
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMeta {
    pub tmux_session: String,
    pub name: String,
    pub agent_type: String,
    pub working_dir: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
    #[serde(default)]
    pub cost_budget_usd: f64,
    #[serde(default)]
    pub startup_command: Option<String>,
    #[serde(default)]
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
}

fn meta_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home)
        .join(".config")
        .join("luffy")
        .join("sessions.json")
}

pub fn load_meta() -> Vec<SessionMeta> {
    let path = meta_path();
    if !path.exists() {
        return vec![];
    }
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_meta(sessions: &[SessionMeta]) -> Result<()> {
    let path = meta_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, serde_json::to_string_pretty(sessions)?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn with_temp_home(f: impl FnOnce()) {
        let _guard = crate::TEST_HOME_LOCK
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let dir = tempfile::tempdir().unwrap();
        let orig = std::env::var("HOME").unwrap_or_default();
        std::env::set_var("HOME", dir.path());
        f();
        std::env::set_var("HOME", orig);
    }

    #[test]
    fn created_at_roundtrips() {
        with_temp_home(|| {
            let ts = chrono::DateTime::parse_from_rfc3339("2026-03-12T10:00:00Z")
                .unwrap()
                .with_timezone(&chrono::Utc);
            let meta = vec![SessionMeta {
                tmux_session: "luffy-x".to_string(),
                name: "x".to_string(),
                agent_type: "generic".to_string(),
                working_dir: None,
                note: None,
                cost_budget_usd: 0.0,
                startup_command: None,
                created_at: Some(ts),
            }];
            save_meta(&meta).unwrap();
            let loaded = load_meta();
            assert_eq!(loaded[0].created_at, Some(ts));
        });
    }

    #[test]
    fn created_at_defaults_to_none_for_old_files() {
        with_temp_home(|| {
            // Write a meta without created_at (simulating an old sessions.json)
            let json = r#"[{"tmux_session":"luffy-y","name":"y","agent_type":"generic"}]"#;
            let path = std::env::var("HOME").unwrap();
            let dir = std::path::PathBuf::from(path).join(".config").join("luffy");
            std::fs::create_dir_all(&dir).unwrap();
            std::fs::write(dir.join("sessions.json"), json).unwrap();
            let loaded = load_meta();
            assert_eq!(loaded[0].created_at, None);
        });
    }

    #[test]
    fn load_returns_empty_when_no_file() {
        with_temp_home(|| {
            assert_eq!(load_meta().len(), 0);
        });
    }

    #[test]
    fn save_and_load_roundtrip() {
        with_temp_home(|| {
            let meta = vec![SessionMeta {
                tmux_session: "luffy-abc123".to_string(),
                name: "my-feature".to_string(),
                agent_type: "claude-code".to_string(),
                working_dir: Some("/repo".to_string()),
                note: None,
                cost_budget_usd: 0.0,
                startup_command: None,
                created_at: None,
            }];
            save_meta(&meta).unwrap();
            let loaded = load_meta();
            assert_eq!(loaded.len(), 1);
            assert_eq!(loaded[0].tmux_session, "luffy-abc123");
            assert_eq!(loaded[0].agent_type, "claude-code");
            assert_eq!(loaded[0].working_dir, Some("/repo".to_string()));
        });
    }

    #[test]
    fn save_overwrites_previous() {
        with_temp_home(|| {
            let m1 = vec![SessionMeta {
                tmux_session: "t1".into(),
                name: "s1".into(),
                agent_type: "aider".into(),
                working_dir: None,
                note: None,
                cost_budget_usd: 0.0,
                startup_command: None,
                created_at: None,
            }];
            save_meta(&m1).unwrap();
            let m2 = vec![
                SessionMeta {
                    tmux_session: "t1".into(),
                    name: "s1".into(),
                    agent_type: "aider".into(),
                    working_dir: None,
                    note: None,
                    cost_budget_usd: 0.0,
                    startup_command: None,
                    created_at: None,
                },
                SessionMeta {
                    tmux_session: "t2".into(),
                    name: "s2".into(),
                    agent_type: "generic".into(),
                    working_dir: None,
                    note: None,
                    cost_budget_usd: 0.0,
                    startup_command: None,
                    created_at: None,
                },
            ];
            save_meta(&m2).unwrap();
            assert_eq!(load_meta().len(), 2);
        });
    }
}
