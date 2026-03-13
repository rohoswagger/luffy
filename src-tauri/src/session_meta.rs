/// Persists lightweight session metadata to survive app restarts.
/// This complements tmux session persistence with agent type, working dir, etc.
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMeta {
    pub tmux_session: String,
    pub name: String,
    pub agent_type: String,
    pub working_dir: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
}

fn meta_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".config").join("luffy").join("sessions.json")
}

pub fn load_meta() -> Vec<SessionMeta> {
    let path = meta_path();
    if !path.exists() { return vec![]; }
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
    use std::sync::Mutex;

    static LOCK: Mutex<()> = Mutex::new(());

    fn with_temp_home(f: impl FnOnce()) {
        let _guard = LOCK.lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        std::env::set_var("HOME", dir.path());
        f();
        std::env::remove_var("HOME");
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
            let meta = vec![
                SessionMeta {
                    tmux_session: "luffy-abc123".to_string(),
                    name: "my-feature".to_string(),
                    agent_type: "claude-code".to_string(),
                    working_dir: Some("/repo".to_string()),
                    note: None,
                },
            ];
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
            let m1 = vec![SessionMeta { tmux_session: "t1".into(), name: "s1".into(), agent_type: "aider".into(), working_dir: None, note: None }];
            save_meta(&m1).unwrap();
            let m2 = vec![
                SessionMeta { tmux_session: "t1".into(), name: "s1".into(), agent_type: "aider".into(), working_dir: None, note: None },
                SessionMeta { tmux_session: "t2".into(), name: "s2".into(), agent_type: "generic".into(), working_dir: None, note: None },
            ];
            save_meta(&m2).unwrap();
            assert_eq!(load_meta().len(), 2);
        });
    }
}
