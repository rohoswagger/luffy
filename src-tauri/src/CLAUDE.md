# Backend Context (`src-tauri/src/`)

## AppState (lib.rs)
```rust
pub struct AppState {
    pub session_mgr: Arc<SessionManager>,
    pub pty_mgr: Arc<PtyManager>,
}
```
`TEST_HOME_LOCK: Mutex<()>` — shared across all test modules that mutate `HOME` env var (prevents race conditions in parallel tests).

## Modules

### `session/`
- `model.rs` — `Session`, `AgentStatus` (Idle/Thinking/WaitingForInput/Error/Done), `AgentType` (ClaudeCode/Aider/Generic)
  - `tmux_session` format: `luffy-{first-8-chars-of-uuid}`
  - `created_at` persisted to `session_meta.rs` so it survives restarts
- `manager.rs` — `SessionManager` (Arc<Mutex<HashMap<id, Session>>>)
  - Key methods: `create_session`, `kill_session`, `list_sessions`, `update_status`, `update_output_preview`, `update_cost`, `get_fork_args`, `get_restart_args`, `rename_session`, `set_session_note`, `set_startup_command`, `set_cost_budget`, `get_events`, `mark_dead_sessions`, `stale_terminal_sessions`, `restore_from_tmux`, `persist_meta`, `extract_preview` (uses `OnceLock<Regex>` for ANSI stripping)
  - `restore_from_tmux` — reconciles live `tmux ls` output with `session_meta.json`; uses stored `created_at`
- `events.rs` — `SessionEvent { kind, timestamp, detail }` — timeline of status/cost changes
- `health.rs` — `is_tmux_session_alive(name)` — checks via `tmux has-session`

### `status/detector.rs`
Detects agent status from PTY output chunks:
- `is_thinking` — braille spinners, "Thinking"/"Working"/"Analyzing"/"Processing", "✻ ", "Sending..."
- `is_waiting_for_input` — OnceLock regex: `^\s*>\s*$`, `❯\s*$`, `[Y/n]`/`[N/y]`, `(y/n)`, `│ > `, "Do you want to", "Press...to"
- `is_error` — "Error:"/"Failed:"/etc. in last 500 chars
- `is_done` — "✓ Done", "✔ Done", "Task complete", "All done", "Completed successfully", "LGTM", "No changes to make", "Nothing to do" in last 200 chars

### `pty_stream.rs`
- `PtyManager` — spawns PTY via `portable-pty`, attaches to tmux session with `tmux attach-session -t`
- Rolling 50KB ANSI-stripped output buffers per session (`output_buffers`)
- `strip_ansi(s)` — strips VT escape sequences + `\r`; used for search buffers + preview
- Key methods: `attach`, `detach`, `write_input`, `get_output`, `resize`

### `cost.rs`
- `detect_cost(output)` — finds lines containing "cost" (case-insensitive), extracts max `$N.NN` amount
- Used on every PTY chunk; triggers `cost-budget-exceeded` event when total > budget

### `stuck_detector.rs`
- `StuckDetector { threshold_secs }` — tracks last PTY output snapshot per session
- Background loop checks every 10s; if THINKING session's output hasn't changed for 15 min → sends Ctrl+C, emits `session-stuck`

### `auto_respond.rs`
- `AutoResponse { id, pattern, response, enabled }`
- `check_auto_respond(output, patterns)` — case-insensitive substring match, returns first match's response
- Persisted at `~/.config/luffy/auto_responses.json`
- Default patterns (all disabled): `[Y/n]`, `(y/n)`, `(Y/n)`, "press enter to continue", "do you want to"

### `session_meta.rs`
- `SessionMeta` — lightweight snapshot for persistence across restarts
- Fields: `tmux_session, name, agent_type, working_dir, note, cost_budget_usd, startup_command, created_at`
- Stored at `~/.config/luffy/sessions.json`

### `templates.rs`
- `SessionTemplate { id, name, agent_type, working_dir, count, startup_command, cost_budget_usd }`
- Persisted at `~/.config/luffy/templates.json`

### `git.rs`
- `detect_git_info(dir)` → `(Option<branch>, Option<worktree_path>)`
- `create_worktree(base_dir, name)` — creates `.worktrees/<name>` git worktree
- `remove_worktree(repo_path, wt_path)` — called on session kill if path contains `/.worktrees/`

### `commands/mod.rs`
All Tauri commands. Key patterns:
- After state-mutating commands, always emit `sessions-updated` with full session list
- `attach_pty` helper wires PTY → status detection → cost detection → event emission
- `create_session` / `fork_session` / `restart_session` all follow the same pattern: create → set optional fields → attach_pty → send startup_command → emit sessions-updated

## Background Loop (lib.rs, every 10s)
1. `mark_dead_sessions` — ERROR if tmux session gone
2. Every 60s: `stale_terminal_sessions` — remove DONE/ERROR older than 30 min
3. Over-budget sessions: detach PTY + kill session + cleanup worktree
4. Auto-respond: check WAITING sessions against patterns; send response if new output matches
5. Stuck detection: `StuckDetector` sends Ctrl+C to THINKING sessions with no output change for 15 min
6. Batch-done notification: emit `batch-done` when all THINKING/WAITING sessions finish

## Tauri Commands Registered
`create_session`, `kill_session`, `list_sessions`, `send_input`, `broadcast_input`,
`restore_sessions`, `rename_session`, `set_session_note`, `fork_session`,
`list_templates`, `save_template`, `delete_template`,
`list_auto_responses`, `add_auto_response`, `delete_auto_response`, `toggle_auto_response`,
`export_session_output`, `get_session_events`, `mark_session_done`, `restart_session`,
`resize_pty`, `get_pty_output`, `search_output`

## Test Patterns
- Rust: `cd src-tauri && cargo test` — 99 tests
- Tests that mutate `HOME`: use `with_temp_home(|| { ... })` via `crate::TEST_HOME_LOCK`
- Frontend: `bun run test --run` — 134 tests
