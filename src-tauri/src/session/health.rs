use std::process::Command;

/// Check whether a tmux session with the given name currently exists.
pub fn is_tmux_session_alive(name: &str) -> bool {
    Command::new("tmux")
        .args(["has-session", "-t", name])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_false_for_nonexistent_session() {
        assert!(!is_tmux_session_alive("luffy-nonexistent-xzq7k9m2p4"));
    }
}
