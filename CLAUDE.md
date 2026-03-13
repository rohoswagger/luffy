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

## Detailed Context (read these after compaction — saves re-reading source)
- `src/CLAUDE.md` — full frontend map: components, store, hooks, utils, keyboard shortcuts
- `src-tauri/src/CLAUDE.md` — full backend map: all modules, commands, background loop, test patterns

## Architecture (summary)

### Frontend (`src/`)
- `App.tsx` — root; owns all state, keyboard shortcuts, session action handlers
- `store/sessions.ts` — Zustand store (single source of truth)
- `hooks/useTauri.ts` — all Tauri IPC + event listeners
- `utils/sessions.ts` — pure utils: sortByPriority, isStuck, nextWaiting
- `utils/time.ts` — formatDuration, formatRelativeTime
- `components/` — 15 components each with `.test.tsx`

### Backend (`src-tauri/src/`)
- `session/` — Session lifecycle (manager, model, events, health)
- `status/detector.rs` — PTY output → AgentStatus (OnceLock regex)
- `pty_stream.rs` — PTY attach/stream, 50KB ANSI-stripped rolling buffers
- `cost.rs` — USD cost extraction from PTY output
- `stuck_detector.rs` — auto-interrupt THINKING sessions stuck 15+ min
- `auto_respond.rs` — pattern-match WAITING sessions and auto-reply
- `templates.rs` — session templates (~/.config/luffy/templates.json)
- `session_meta.rs` — session persistence (~/.config/luffy/sessions.json)
- `git.rs` — branch/worktree detection and creation
- `commands/mod.rs` — all Tauri IPC command handlers

### Key Events (Tauri → Frontend)
- `sessions-updated` — full session list on any state change
- `pty-output-{sessionId}` — raw terminal output chunk
- `agent-needs-input` — session entered WAITING (desktop notification)
- `cost-budget-exceeded` — session exceeded its cost budget
- `session-stuck` — Ctrl+C sent to stuck THINKING session
- `batch-done` — all THINKING/WAITING sessions finished

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
- `~/.config/luffy/auto_responses.json` — Auto-respond patterns
