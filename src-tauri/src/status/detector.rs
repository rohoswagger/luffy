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
        // Braille spinner characters
        "⠋",
        "⠙",
        "⠹",
        "⠸",
        "⠼",
        "⠴",
        "⠦",
        "⠧",
        "⠇",
        "⠏",
        // Generic thinking words
        "Thinking",
        "Working",
        "Analyzing",
        "Processing",
        // Claude Code specific: ✻ prefix on thinking lines
        "✻ ",
        // Aider specific
        "Sending...",
    ];
    patterns.iter().any(|p| output.contains(p))
}

fn is_waiting_for_input(output: &str) -> bool {
    use std::sync::OnceLock;
    static RE: OnceLock<Regex> = OnceLock::new();
    // Match agent-specific waiting patterns (narrow enough to avoid false positives):
    //   ^\s*>\s*$      - line containing only ">" (interactive Python/node prompt)
    //   ❯\s*$          - zsh right-arrow prompt at end of line
    //   [Y/n]/[N/y]    - confirmation prompts
    //   Press.*to\s    - "Press Enter to continue" style
    //   \(y/n\)        - lowercase (y/n) variant used by some tools
    //   │\s*>\s         - Claude Code input box prompt ("│ > ")
    //   Do you want to - Claude Code permission prompts
    let re = RE.get_or_init(|| {
        Regex::new(r"(?m)(^\s*>\s*$|❯\s*$|\[[Yy]/[Nn]\]|\[[Nn]/[Yy]\]|Press .{1,30} to\s|\(y/n\)|\(Y/n\)|\(N/y\)|│\s*>\s|Do you want to )").unwrap()
    });
    re.is_match(output)
}

fn is_error(output: &str) -> bool {
    // Use specific multi-word patterns to avoid false positives on common single characters
    let patterns = [
        "Error:", "error:", "ERROR:", "Failed:", "failed:", "FAILED:",
    ];
    let recent = if output.len() > 500 {
        &output[output.len() - 500..]
    } else {
        output
    };
    patterns.iter().any(|p| recent.contains(p))
}

fn is_done(output: &str) -> bool {
    // Match agent completion markers specifically (not just "Done" which appears in many contexts)
    let patterns = [
        "✓ Done",
        "✔ Done",
        "Task complete",
        "All done",
        "Completed successfully",
        "LGTM",
        "No changes to make",
        "Nothing to do",
    ];
    let recent = if output.len() > 200 {
        &output[output.len() - 200..]
    } else {
        output
    };
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
    fn detects_waiting_interactive_prompt() {
        let output = "Please provide a filename:\n> ";
        assert_eq!(detect_status(output), Some(AgentStatus::WaitingForInput));
    }

    #[test]
    fn detects_waiting_yn_prompt() {
        let output = "Overwrite file? [Y/n] ";
        assert_eq!(detect_status(output), Some(AgentStatus::WaitingForInput));
    }

    #[test]
    fn does_not_false_positive_on_gt_in_output() {
        // Lines ending with > in normal code output should not trigger WAITING
        let output = "fn foo() -> bool {\n  x > y\n}";
        assert_eq!(detect_status(output), None);
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
    fn done_does_not_false_positive_on_standalone_done() {
        // lowercase "done" at end of sentence should NOT trigger done status
        let output = "saved file content.done\nReady to continue";
        assert_eq!(detect_status(output), None);
    }

    #[test]
    fn error_does_not_false_positive_on_symbols() {
        // ✗ alone should not trigger error status
        let output = "checking ✗ some ui element";
        assert_eq!(detect_status(output), None);
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

    #[test]
    fn detects_waiting_lowercase_yn_prompt() {
        let output = "Run this command? (y/n) ";
        assert_eq!(detect_status(output), Some(AgentStatus::WaitingForInput));
    }

    #[test]
    fn detects_waiting_claude_code_input_box() {
        let output =
            "╭──────────────────────────────────╮\n│ > \n╰──────────────────────────────────╯";
        assert_eq!(detect_status(output), Some(AgentStatus::WaitingForInput));
    }

    #[test]
    fn detects_waiting_do_you_want_to() {
        let output = "Do you want to run this bash command?";
        assert_eq!(detect_status(output), Some(AgentStatus::WaitingForInput));
    }

    #[test]
    fn detects_done_no_changes() {
        let output = "Checking files...\nNo changes to make";
        assert_eq!(detect_status(output), Some(AgentStatus::Done));
    }
}
