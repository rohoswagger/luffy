# Luffy — Development Guide for Claude

## Project Overview
A macOS desktop app for managing multiple tmux-based AI coding agent sessions. Target users: 100x engineers running many agents overnight.

## Tech Stack
- **Frontend**: React 19 + TypeScript, Zustand, xterm.js v5
- **Backend**: Tauri 2 + Rust, portable-pty
- **Tests**: Vitest + @testing-library/react (frontend), cargo test (Rust)
- **Package manager**: bun (not npm)

## Development Rules

### Test-Driven Development (MANDATORY)
Always write tests BEFORE implementation:
1. Write failing test
2. Run test to confirm it fails
3. Implement minimal code to pass
4. Run tests to confirm they pass
5. Commit

### Formatting (run before commit)
```bash
# Frontend
bun run prettier --write src/

# Rust
cargo fmt --all
cargo clippy
```

### Running Tests
```bash
# Frontend tests
bun run test --run

# Rust tests
cd src-tauri && cargo test
```

## Architecture

### Frontend (`src/`)
- `components/` — UI components, each with a `.test.tsx` file
- `hooks/useTauri.ts` — All Tauri IPC calls and event listeners
- `store/sessions.ts` — Zustand store (single source of truth for sessions)
- `utils/sessions.ts` — Pure utility functions (nextWaiting, sortByPriority, isStuck)
- `utils/time.ts` — formatRelativeTime utility

### Backend (`src-tauri/src/`)
- `session/` — Session lifecycle (manager, model, events, health)
- `status/` — Agent status detection from PTY output
- `pty_stream.rs` — PTY attach/stream, output buffers (50KB rolling)
- `cost.rs` — USD cost detection from agent output
- `templates.rs` — Session template persistence (~/.config/luffy/templates.json)
- `session_meta.rs` — Session metadata persistence (~/.config/luffy/sessions.json)
- `git.rs` — Git branch/worktree detection
- `commands/` — Tauri IPC command handlers

### Key Tauri Commands
- `create_session`, `kill_session`, `list_sessions`, `send_input`, `broadcast_input`
- `restore_sessions` — Restore sessions from tmux + metadata on startup
- `search_output` — Cross-session search in output buffers
- `get_session_events` — Timeline of status/cost events per session
- `export_session_output` — Export to ~/Downloads
- `fork_session` — Clone a session with same config
- `rename_session` — Rename session display name
- `resize_pty` — Sync terminal dimensions
- `list_templates`, `save_template`, `delete_template`

### Key Events (Tauri → Frontend)
- `sessions-updated` — Any session state change, carries full session list
- `pty-output-{sessionId}` — Terminal output chunk for specific session
- `agent-needs-input` — Agent entered WAITING state (triggers desktop notification)

## Background Tasks (Rust)
Background loop in `lib.rs` runs every 10s:
- Marks sessions ERROR if tmux session is dead
- Every 60s: removes DONE/ERROR sessions older than 30 minutes

## Session Status Flow
```
Idle → Thinking (spinner detected)
Thinking → WaitingForInput ([Y/n] or interactive prompt detected)
Any → Error (Error:/Failed: detected in recent output)
Any → Done (✓ Done pattern detected)
```

## Common Patterns

### Adding a new Tauri command
1. Write test in `commands/mod.rs` (or relevant module)
2. Implement function with `#[tauri::command]`
3. Register in `lib.rs` `invoke_handler![]`
4. Add TypeScript wrapper in `hooks/useTauri.ts`
5. Wire in `App.tsx`

### Adding a new frontend component
1. Create `ComponentName.test.tsx` with tests
2. Create `ComponentName.tsx` implementation
3. Import and use in parent component

## Config Files Location
- `~/.config/luffy/templates.json` — Session templates
- `~/.config/luffy/sessions.json` — Session metadata (for persistence)
