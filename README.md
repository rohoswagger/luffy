# Luffy

A macOS desktop app for managing multiple tmux-based AI coding agent sessions in one unified UI. Built for the 100x engineer who runs multiple AI agents in parallel overnight.

## Features

- **Multi-session management** — Create, monitor, and kill tmux sessions for Claude Code, Aider, or any generic agent
- **Live terminal output** — xterm.js-powered terminals with PTY streaming per session
- **Status detection** — Automatically detect agent state: THINKING (spinner), WAITING (needs input), IDLE, ERROR, DONE
- **Session health monitor** — Background check every 10s detects dead tmux sessions and marks them ERROR
- **Auto-cleanup** — DONE/ERROR sessions older than 30 min are automatically removed
- **Session forking** — Clone any session with same config to try a parallel approach (⊕ button)
- **Session rename** — Double-click any session name to rename it inline
- **Multi-pane layouts** — 1-up, 2-up, or 4-up grid views (Cmd+Shift+1/2/4)
- **Attention management** — Amber badge shows count of WAITING sessions; Cmd+Shift+A jumps to next one
- **Command palette** — Fuzzy search sessions by name, branch, or type (Cmd+K)
- **Cross-session search** — Search output buffers across all sessions (Cmd+Shift+F)
- **Broadcast input** — Send the same command to all agents simultaneously
- **Batch session creation** — Spawn N parallel workers at once from the new session modal
- **Session templates** — Save and relaunch session configurations
- **Session event log** — Timeline of status changes and cost updates per session (Cmd+L)
- **Quick commands** — Preset y/n/continue buttons when agent is WAITING
- **Cost tracking** — Per-session and total USD cost detection from agent output
- **Session export** — Export session output to ~/Downloads as a log file
- **Git context** — Auto-detect branch and worktree path from working directory
- **Git worktree auto-creation** — Optionally create a dedicated git worktree + branch per session so agents don't conflict
- **Startup command** — Auto-launch `claude`, `aider`, or custom command when a session starts
- **Live output preview** — See the last meaningful line of each session's terminal output in the sidebar at a glance
- **Session notes** — Attach a freeform note to any session (double-click to edit, persisted across restarts)
- **Auto-respond patterns** — Configure patterns (e.g., `[y/n]` → `y`) that auto-reply when agents are WAITING — perfect for overnight runs
- **Desktop notifications** — macOS notification when any agent needs your input
- **Session persistence** — Restores existing `luffy-*` tmux sessions on app restart

## Stack

- **Frontend**: React 19 + TypeScript + Zustand + xterm.js v5
- **Backend**: Tauri 2 + Rust + portable-pty
- **Testing**: Vitest + @testing-library/react + cargo test (109 frontend + 80 Rust = 189 tests)
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
| Cmd+W | Kill active session |
| Cmd+K | Command palette (fuzzy session search) |
| Cmd+Shift+F | Search output across all sessions |
| Cmd+Shift+A | Jump to next WAITING session |
| Cmd+1–9 | Switch to session by index |
| Cmd+[ / ] | Cycle sessions |
| Cmd+T | Session templates |
| Cmd+Shift+R | Auto-respond patterns |
| Cmd+L | Toggle event log panel |
| Cmd+/ | Keyboard shortcuts help |
| Cmd+Shift+1 | 1-pane layout |
| Cmd+Shift+2 | 2-pane layout |
| Cmd+Shift+4 | 4-pane layout |

## Architecture

```
src/                    # React frontend
  components/           # UI components
  hooks/useTauri.ts     # Tauri IPC + event hooks
  store/sessions.ts     # Zustand session state
  utils/                # time.ts, sessions.ts helpers

src-tauri/src/          # Rust backend
  session/              # Session lifecycle, health checks, events
  status/               # Agent status detection from PTY output
  pty_stream.rs         # PTY attach/stream via portable-pty
  git.rs                # Git branch/worktree detection and creation
  cost.rs               # USD cost detection from agent output
  templates.rs          # Session template persistence
  auto_respond.rs       # Auto-response pattern matching and persistence
  commands/             # Tauri IPC command handlers
```
