/// Auto-respond: automatically reply to common agent prompts.
/// When an agent is WAITING and its last output matches a pattern,
/// Luffy automatically sends the configured response.
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AutoResponse {
    pub id: String,
    pub pattern: String,
    pub response: String,
    pub enabled: bool,
}

impl AutoResponse {
    pub fn new(pattern: &str, response: &str) -> Self {
        AutoResponse {
            id: Uuid::new_v4().to_string(),
            pattern: pattern.to_string(),
            response: response.to_string(),
            enabled: true,
        }
    }
}

/// Returns the response to send if any enabled pattern matches the output.
/// Matching is case-insensitive substring search.
pub fn check_auto_respond(output: &str, patterns: &[AutoResponse]) -> Option<String> {
    let output_lower = output.to_lowercase();
    patterns
        .iter()
        .filter(|p| p.enabled && !p.pattern.is_empty())
        .find(|p| output_lower.contains(&p.pattern.to_lowercase()))
        .map(|p| p.response.clone())
}

fn auto_respond_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home)
        .join(".config")
        .join("luffy")
        .join("auto_responses.json")
}

pub fn load_auto_responses() -> Vec<AutoResponse> {
    let path = auto_respond_path();
    if !path.exists() {
        return default_patterns();
    }
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(default_patterns)
}

pub fn save_auto_responses(patterns: &[AutoResponse]) -> Result<()> {
    let path = auto_respond_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, serde_json::to_string_pretty(patterns)?)?;
    Ok(())
}

pub fn add_auto_response(pattern: AutoResponse) -> Result<Vec<AutoResponse>> {
    let mut patterns = load_auto_responses();
    patterns.push(pattern);
    save_auto_responses(&patterns)?;
    Ok(patterns)
}

pub fn delete_auto_response(id: &str) -> Result<Vec<AutoResponse>> {
    let mut patterns = load_auto_responses();
    patterns.retain(|p| p.id != id);
    save_auto_responses(&patterns)?;
    Ok(patterns)
}

pub fn toggle_auto_response(id: &str, enabled: bool) -> Result<Vec<AutoResponse>> {
    let mut patterns = load_auto_responses();
    if let Some(p) = patterns.iter_mut().find(|p| p.id == id) {
        p.enabled = enabled;
    }
    save_auto_responses(&patterns)?;
    Ok(patterns)
}

fn default_patterns() -> Vec<AutoResponse> {
    vec![
        AutoResponse {
            id: "default-yn".to_string(),
            pattern: "[y/n]".to_string(),
            response: "y".to_string(),
            enabled: false,
        },
        AutoResponse {
            id: "default-yn2".to_string(),
            pattern: "(y/n)".to_string(),
            response: "y".to_string(),
            enabled: false,
        },
        AutoResponse {
            id: "default-yn3".to_string(),
            pattern: "(Y/n)".to_string(),
            response: "y".to_string(),
            enabled: false,
        },
        AutoResponse {
            id: "default-enter".to_string(),
            pattern: "press enter to continue".to_string(),
            response: "".to_string(),
            enabled: false,
        },
        AutoResponse {
            id: "default-do-you-want".to_string(),
            pattern: "do you want to".to_string(),
            response: "y".to_string(),
            enabled: false,
        },
    ]
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
    fn check_auto_respond_matches_substring_case_insensitive() {
        let patterns = vec![AutoResponse::new("[y/n]", "y")];
        let result = check_auto_respond("Do you want to continue? [Y/N]", &patterns);
        assert_eq!(result, Some("y".to_string()));
    }

    #[test]
    fn check_auto_respond_returns_none_when_no_match() {
        let patterns = vec![AutoResponse::new("[y/n]", "y")];
        assert!(check_auto_respond("Running tests...", &patterns).is_none());
    }

    #[test]
    fn check_auto_respond_skips_disabled_patterns() {
        let mut p = AutoResponse::new("[y/n]", "y");
        p.enabled = false;
        assert!(check_auto_respond("Continue? [Y/N]", &[p]).is_none());
    }

    #[test]
    fn check_auto_respond_returns_first_match() {
        let patterns = vec![
            AutoResponse::new("continue", "yes"),
            AutoResponse::new("[y/n]", "y"),
        ];
        // Both match, should return first
        let result = check_auto_respond("Do you want to continue? [y/n]", &patterns);
        assert_eq!(result, Some("yes".to_string()));
    }

    #[test]
    fn load_returns_defaults_when_no_file() {
        with_temp_home(|| {
            let patterns = load_auto_responses();
            assert!(!patterns.is_empty());
            assert!(patterns.iter().any(|p| p.id == "default-yn"));
        });
    }

    #[test]
    fn add_and_load_roundtrip() {
        with_temp_home(|| {
            let p = AutoResponse::new("are you sure", "yes");
            let saved = add_auto_response(p.clone()).unwrap();
            // defaults + new one
            assert!(saved.iter().any(|x| x.pattern == "are you sure"));
            let loaded = load_auto_responses();
            assert!(loaded.iter().any(|x| x.id == p.id));
        });
    }

    #[test]
    fn delete_removes_pattern() {
        with_temp_home(|| {
            let p = AutoResponse::new("test pattern", "ok");
            let id = p.id.clone();
            add_auto_response(p).unwrap();
            let after = delete_auto_response(&id).unwrap();
            assert!(after.iter().all(|x| x.id != id));
        });
    }

    #[test]
    fn toggle_changes_enabled_state() {
        with_temp_home(|| {
            let p = AutoResponse::new("test", "ok");
            let id = p.id.clone();
            add_auto_response(p).unwrap();
            let after = toggle_auto_response(&id, false).unwrap();
            assert!(!after.iter().find(|x| x.id == id).unwrap().enabled);
        });
    }
}
