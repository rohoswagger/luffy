use crate::session::AgentStatus;
use regex::Regex;

/// Detects agent status from recent terminal output.
/// Returns Some(status) when a pattern is matched, None for normal output.
pub fn detect_status(recent_output: &str) -> Option<AgentStatus> {
    if is_thinking(recent_output) {
        return Some(AgentStatus::Thinking);
    }
    if is_waiting_for_input(recent_output) {
        return Some(AgentStatus::WaitingForInput);
    }
    if is_error(recent_output) {
        return Some(AgentStatus::Error);
    }
    if is_done(recent_output) {
        return Some(AgentStatus::Done);
    }
    None
}

fn is_thinking(output: &str) -> bool {
    let patterns = [
        "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏",
        "Thinking",
        "Working",
        "Analyzing",
        "Processing",
    ];
    patterns.iter().any(|p| output.contains(p))
}

fn is_waiting_for_input(output: &str) -> bool {
    use std::sync::OnceLock;
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| Regex::new(r"(?m)(^\s*>\s*$|❯\s*$|>\s*$|\?\s*$)").unwrap());
    re.is_match(output)
}

fn is_error(output: &str) -> bool {
    let patterns = ["Error:", "error:", "ERROR", "failed:", "Failed:", "✗", "✖", "×"];
    let recent = if output.len() > 500 { &output[output.len() - 500..] } else { output };
    patterns.iter().any(|p| recent.contains(p))
}

fn is_done(output: &str) -> bool {
    let patterns = ["✓", "✔", "Done", "Completed", "Finished", "LGTM"];
    let recent = if output.len() > 200 { &output[output.len() - 200..] } else { output };
    patterns.iter().any(|p| recent.contains(p))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_thinking_spinner() {
        let output = "some output\n⠋ Analyzing files...";
        assert_eq!(detect_status(output), Some(AgentStatus::Thinking));
    }

    #[test]
    fn detects_waiting_prompt() {
        let output = "Please provide a filename:\n> ";
        assert_eq!(detect_status(output), Some(AgentStatus::WaitingForInput));
    }

    #[test]
    fn detects_error() {
        let output = "Running tests...\nError: compilation failed";
        assert_eq!(detect_status(output), Some(AgentStatus::Error));
    }

    #[test]
    fn detects_done() {
        let output = "All tests pass\n✓ Done";
        assert_eq!(detect_status(output), Some(AgentStatus::Done));
    }

    #[test]
    fn returns_none_for_normal_output() {
        let output = "Reading file src/main.rs\nFound 42 lines";
        assert_eq!(detect_status(output), None);
    }

    #[test]
    fn error_check_is_recency_bounded() {
        let mut output = "Error: something old\n".to_string();
        output.push_str(&"x".repeat(600));
        assert_eq!(detect_status(&output), None);
    }
}
