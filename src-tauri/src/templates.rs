use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SessionTemplate {
    pub id: String,
    pub name: String,
    pub agent_type: String,
    pub working_dir: Option<String>,
    pub count: u32,
}

impl SessionTemplate {
    pub fn new(name: &str, agent_type: &str, working_dir: Option<String>, count: u32) -> Self {
        SessionTemplate {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.to_string(),
            agent_type: agent_type.to_string(),
            working_dir,
            count: count.max(1),
        }
    }
}

fn templates_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let config_dir = PathBuf::from(&home).join(".config").join("luffy");
    let _ = std::fs::create_dir_all(&config_dir);
    config_dir.join("templates.json")
}

pub fn load_templates() -> Result<Vec<SessionTemplate>> {
    let path = templates_path();
    if !path.exists() {
        return Ok(vec![]);
    }
    let data = std::fs::read_to_string(&path)?;
    Ok(serde_json::from_str(&data)?)
}

pub fn save_templates(templates: &[SessionTemplate]) -> Result<()> {
    let path = templates_path();
    let data = serde_json::to_string_pretty(templates)?;
    std::fs::write(path, data)?;
    Ok(())
}

pub fn add_template(template: SessionTemplate) -> Result<Vec<SessionTemplate>> {
    let mut templates = load_templates()?;
    templates.push(template);
    save_templates(&templates)?;
    Ok(templates)
}

pub fn delete_template(id: &str) -> Result<Vec<SessionTemplate>> {
    let mut templates = load_templates()?;
    templates.retain(|t| t.id != id);
    save_templates(&templates)?;
    Ok(templates)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::sync::Mutex;

    // Serialise env mutations to prevent race conditions in parallel test execution.
    static LOCK: Mutex<()> = Mutex::new(());

    fn with_temp_home<F: FnOnce()>(f: F) {
        let _guard = LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let tmp = tempfile::tempdir().unwrap();
        let orig = env::var("HOME").unwrap_or_default();
        env::set_var("HOME", tmp.path());
        f();
        env::set_var("HOME", orig);
    }

    #[test]
    fn new_template_has_valid_id() {
        let t = SessionTemplate::new("worker", "claude-code", Some("/repo".to_string()), 3);
        assert!(!t.id.is_empty());
        assert_eq!(t.name, "worker");
        assert_eq!(t.count, 3);
    }

    #[test]
    fn count_clamped_to_min_1() {
        let t = SessionTemplate::new("w", "generic", None, 0);
        assert_eq!(t.count, 1);
    }

    #[test]
    fn load_templates_returns_empty_when_no_file() {
        with_temp_home(|| {
            let templates = load_templates().unwrap();
            assert!(templates.is_empty());
        });
    }

    #[test]
    fn add_and_load_template_roundtrips() {
        with_temp_home(|| {
            let t = SessionTemplate::new("my-worker", "aider", None, 2);
            let saved = add_template(t.clone()).unwrap();
            assert_eq!(saved.len(), 1);
            assert_eq!(saved[0].name, "my-worker");

            let loaded = load_templates().unwrap();
            assert_eq!(loaded.len(), 1);
            assert_eq!(loaded[0].id, t.id);
        });
    }

    #[test]
    fn delete_template_removes_by_id() {
        with_temp_home(|| {
            let t1 = SessionTemplate::new("a", "claude-code", None, 1);
            let t2 = SessionTemplate::new("b", "aider", None, 1);
            add_template(t1.clone()).unwrap();
            add_template(t2).unwrap();
            let after = delete_template(&t1.id).unwrap();
            assert_eq!(after.len(), 1);
            assert_eq!(after[0].name, "b");
        });
    }
}
