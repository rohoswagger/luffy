# Luffy

A macOS desktop app for managing multiple tmux-based AI coding agent sessions in one unified UI. Built for the 100x engineer who runs multiple AI agents in parallel overnight.

## Features

- **Multi-session management** — Create, monitor, and kill tmux sessions for Claude Code, Aider, or any generic agent
- **Live terminal output** — xterm.js-powered terminals with PTY streaming per session
- **Status detection** — Automatically detect agent state: THINKING (spinner), WAITING (needs input), IDLE, ERROR, DONE
- **Multi-pane layouts** — 1-up, 2-up, or 4-up grid views (Cmd+Shift+1/2/4)
- **Command palette** — Fuzzy search sessions by name, branch, or type (Cmd+K)
- **Broadcast input** — Send the same command to all agents simultaneously
- **Batch session creation** — Spawn N parallel workers at once from the new session modal
- **Git context** — Auto-detect branch and worktree path from working directory
- **Desktop notifications** — macOS notification when any agent needs your input
- **Session persistence** — Restores existing `luffy-*` tmux sessions on app restart

## Stack

- **Frontend**: React 19 + TypeScript + Zustand + xterm.js v5
- **Backend**: Tauri 2 + Rust + portable-pty
- **Testing**: Vitest + @testing-library/react + cargo test
- **Package manager**: bun

## Development

```bash
# Install dependencies
bun install

# Run frontend tests
bun run test

# Run Rust tests
cd src-tauri && cargo test

# Start dev server (requires Tauri CLI)
bun run tauri dev

# Build app
bun run tauri build
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+N | New session |
| Cmd+K | Command palette (fuzzy session search) |
| Cmd+W | Kill active session |
| Cmd+1–9 | Switch to session by index |
| Cmd+[ / ] | Cycle sessions |
| Cmd+Shift+1 | 1-pane layout |
| Cmd+Shift+2 | 2-pane layout |
| Cmd+Shift+4 | 4-pane layout |

## Architecture

```
src/                    # React frontend
  components/           # UI components
  hooks/useTauri.ts     # Tauri IPC + event hooks
  store/sessions.ts     # Zustand session state

src-tauri/src/          # Rust backend
  session/              # Session lifecycle (tmux commands)
  status/               # Agent status detection from PTY output
  pty_stream.rs         # PTY attach/stream via portable-pty
  git.rs                # Git branch/worktree detection
  commands/             # Tauri IPC command handlers
```
