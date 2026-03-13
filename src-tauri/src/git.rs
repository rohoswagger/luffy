use std::process::Command;

/// Detect git branch and worktree root for a given directory.
/// Returns (branch, worktree_path). Either may be None if not in a git repo.
pub fn detect_git_info(dir: &str) -> (Option<String>, Option<String>) {
    let branch = Command::new("git")
        .args(["-C", dir, "branch", "--show-current"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if s.is_empty() { None } else { Some(s) }
        });

    let worktree = Command::new("git")
        .args(["-C", dir, "rev-parse", "--show-toplevel"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if s.is_empty() { None } else { Some(s) }
        });

    (branch, worktree)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command as Cmd;

    fn init_git_repo(dir: &std::path::Path) {
        Cmd::new("git").args(["init"]).current_dir(dir).output().unwrap();
        Cmd::new("git").args(["checkout", "-b", "main"]).current_dir(dir).output().unwrap();
        // Need at least one commit for branch --show-current to return a name
        fs::write(dir.join(".gitkeep"), "").unwrap();
        Cmd::new("git").args(["add", "."]).current_dir(dir).output().unwrap();
        Cmd::new("git")
            .args(["commit", "--allow-empty-message", "-m", "init"])
            .current_dir(dir)
            .env("GIT_AUTHOR_NAME", "test")
            .env("GIT_AUTHOR_EMAIL", "test@test.com")
            .env("GIT_COMMITTER_NAME", "test")
            .env("GIT_COMMITTER_EMAIL", "test@test.com")
            .output()
            .unwrap();
    }

    #[test]
    fn detects_branch_and_worktree_in_git_repo() {
        let tmp = tempfile::tempdir().unwrap();
        init_git_repo(tmp.path());
        let dir = tmp.path().to_str().unwrap();

        let (branch, worktree) = detect_git_info(dir);
        assert_eq!(branch.as_deref(), Some("main"));
        assert!(worktree.is_some());
    }

    #[test]
    fn returns_none_for_non_git_directory() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().to_str().unwrap();

        let (branch, worktree) = detect_git_info(dir);
        assert!(branch.is_none());
        assert!(worktree.is_none());
    }

    #[test]
    fn returns_none_for_nonexistent_directory() {
        let (branch, worktree) = detect_git_info("/nonexistent/path/that/does/not/exist");
        assert!(branch.is_none());
        assert!(worktree.is_none());
    }
}
