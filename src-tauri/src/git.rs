use std::process::Command;

/// Sanitize a name for use as a git branch name.
/// Replaces spaces and special characters with dashes.
pub fn sanitize_branch_name(name: &str) -> String {
    let s: String = name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' { c } else { '-' })
        .collect();
    // Remove leading/trailing dashes
    s.trim_matches('-').to_string()
}

/// Create a git worktree at `<repo>/.worktrees/<branch>` on a new branch.
/// Returns the path of the created worktree on success.
pub fn create_worktree(repo_path: &str, branch: &str) -> Result<String, String> {
    let branch = sanitize_branch_name(branch);
    if branch.is_empty() {
        return Err("Branch name cannot be empty after sanitization".to_string());
    }

    let worktree_dir = std::path::Path::new(repo_path)
        .join(".worktrees")
        .join(&branch);
    let worktree_path = worktree_dir.to_str()
        .ok_or_else(|| "Invalid path".to_string())?
        .to_string();

    let output = Command::new("git")
        .args(["-C", repo_path, "worktree", "add", "-b", &branch, &worktree_path])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git worktree add failed: {}", stderr.trim()));
    }

    Ok(worktree_path)
}

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

    #[test]
    fn sanitize_branch_name_replaces_spaces_with_dashes() {
        assert_eq!(sanitize_branch_name("my feature"), "my-feature");
    }

    #[test]
    fn sanitize_branch_name_keeps_alphanumeric_and_dash() {
        assert_eq!(sanitize_branch_name("feat-auth_v2.0"), "feat-auth_v2.0");
    }

    #[test]
    fn sanitize_branch_name_strips_leading_trailing_dashes() {
        assert_eq!(sanitize_branch_name("  feat  "), "feat");
    }

    #[test]
    fn create_worktree_creates_directory_and_branch() {
        let tmp = tempfile::tempdir().unwrap();
        init_git_repo(tmp.path());
        let repo = tmp.path().to_str().unwrap();

        let result = create_worktree(repo, "my-feature");
        assert!(result.is_ok(), "Expected Ok, got {:?}", result);
        let path = result.unwrap();
        assert!(std::path::Path::new(&path).exists(), "Worktree directory should exist");
    }

    #[test]
    fn create_worktree_fails_on_nonexistent_repo() {
        let result = create_worktree("/nonexistent/repo", "my-branch");
        assert!(result.is_err());
    }
}
