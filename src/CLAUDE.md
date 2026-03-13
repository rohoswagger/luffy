# Frontend Context (`src/`)

## Entry Point
`App.tsx` — root component. Owns all modal/panel state, keyboard shortcuts, session action handlers. Renders SessionSidebar + terminal area + overlays.

## State
`store/sessions.ts` — Zustand store. Single source of truth.
- `sessions: SessionData[]` — full list, updated via `sessions-updated` Tauri event
- `activeSessionId: string | null`
- `setSessions`, `setActiveSession`, `removeSession`

`SessionData` shape (mirrors `SessionDto` from Rust):
```ts
{ id, name, tmux_session, status, agent_type, worktree_path, branch,
  created_at, last_activity, total_cost_usd, cost_budget_usd, note,
  last_output_preview, startup_command }
```
`status` values: `"IDLE" | "THINKING" | "WAITING" | "ERROR" | "DONE"`
`agent_type` values: `"claude-code" | "aider" | "generic"`

## Hooks
`hooks/useTauri.ts` — all Tauri IPC + event wiring:
- `useTauriEvents()` — called once in App.tsx; sets up all event listeners, calls `restore_sessions` on mount
- Events listened: `sessions-updated`, `agent-needs-input`, `cost-budget-exceeded`, `session-stuck`, `batch-done`
- Exports: `createSession`, `killSession`, `broadcastInput`, `forkSession`, `setSessionNote`

## Utils
`utils/sessions.ts`:
- `isSessionStuck(session, now)` — true if THINKING + no activity >10 min
- `sortSessionsByPriority(sessions)` — stable sort: WAITING > THINKING > ERROR > IDLE > DONE
- `nextWaitingSessionId(sessions, currentId)` — cycles through WAITING sessions

`utils/time.ts`:
- `formatDuration(isoString, now)` — elapsed since start: "45m", "2h 15m", "1d 3h"
- `formatRelativeTime(isoString, now)` — "just now", "5m ago", "2h ago"

## Components

| File | Purpose |
|------|---------|
| `SessionSidebar.tsx` | Left panel: session list with status, cost, branch, stuck indicator, rename/note inline editing, filter input, clear-done button |
| `TerminalPane.tsx` | xterm.js v5 terminal; attaches to `pty-output-{id}` event; handles resize |
| `PaneGrid.tsx` | 2-up / 4-up multi-terminal grid layout |
| `LayoutSwitcher.tsx` | Toolbar buttons for 1up/2up/4up layout |
| `StatusBadge.tsx` | Colored pill: IDLE/THINKING/WAITING/ERROR/DONE |
| `NewSessionModal.tsx` | Modal to create session (name, agent type, dir, startup cmd, cost budget, worktree option) |
| `CommandPalette.tsx` | Cmd+K quick-switch between sessions |
| `SearchPanel.tsx` | Cmd+Shift+F cross-session output search via `search_output` command |
| `EventLog.tsx` | Right panel: timeline of status/cost events for active session; refetches when `lastActivity` changes |
| `QuickCommands.tsx` | Bottom bar when session is WAITING: preset replies + custom input |
| `BroadcastBar.tsx` | Bottom bar when >1 session: broadcast text to all or to WAITING only |
| `TemplatesPanel.tsx` | Template CRUD + launch (calls `list_templates`, `save_template`, `delete_template`) |
| `AutoResponsePanel.tsx` | CRUD for auto-respond patterns (Cmd+Shift+R) |
| `KeyboardHelp.tsx` | Cmd+/ help overlay listing all shortcuts |
| `Toast.tsx` | Auto-dismissing bottom-center notification (3s default) |

## Keyboard Shortcuts (defined in App.tsx)
| Key | Action |
|-----|--------|
| Cmd+N | New session |
| Cmd+T | Templates panel |
| Cmd+K | Command palette |
| Cmd+Shift+F | Search panel |
| Cmd+L | Toggle event log |
| Cmd+/ | Toggle keyboard help |
| Cmd+Shift+R | Auto-respond panel |
| Cmd+Shift+A | Jump to next WAITING session |
| Cmd+1–9 | Switch to session by index |
| Cmd+[ / Cmd+] | Previous / next session |
| Cmd+W | Kill active session |
| Cmd+Shift+1/2/4 | Switch layout 1up/2up/4up |
