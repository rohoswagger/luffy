import { useState, useEffect, useCallback } from "react";
import { SessionSidebar } from "./components/SessionSidebar";
import { TerminalPane } from "./components/TerminalPane";
import { PaneGrid } from "./components/PaneGrid";
import type { Layout } from "./components/PaneGrid";
import { BroadcastBar } from "./components/BroadcastBar";
import { LayoutSwitcher } from "./components/LayoutSwitcher";
import { NewSessionModal } from "./components/NewSessionModal";
import { CommandPalette } from "./components/CommandPalette";
import { SearchPanel } from "./components/SearchPanel";
import { EventLog } from "./components/EventLog";
import { QuickCommands } from "./components/QuickCommands";
import { KeyboardHelp } from "./components/KeyboardHelp";
import { TemplatesPanel } from "./components/TemplatesPanel";
import { AutoResponsePanel } from "./components/AutoResponsePanel";
import { Toast } from "./components/Toast";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useSessionStore } from "./store/sessions";
import { invoke } from "@tauri-apps/api/core";
import {
  useTauriEvents,
  createSession,
  killSession,
  broadcastInput,
  forkSession,
} from "./hooks/useTauri";
import { nextWaitingSessionId } from "./utils/sessions";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

export default function App() {
  useTauriEvents();

  const { sessions, activeSessionId, setActiveSession, removeSession } =
    useSessionStore();
  const [showNewModal, setShowNewModal] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showEventLog, setShowEventLog] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAutoRespond, setShowAutoRespond] = useState(false);
  const [layout, setLayout] = useState<Layout>("1up");
  const [toast, setToast] = useState<string | null>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const waitingCount = sessions.filter((s) => s.status === "WAITING").length;

  // Auto-select: pick first session if none selected, or if active session was removed
  useEffect(() => {
    const activeExists = sessions.some((s) => s.id === activeSessionId);
    if ((!activeSessionId || !activeExists) && sessions.length > 0) {
      setActiveSession(sessions[0].id);
    } else if (!activeExists && sessions.length === 0) {
      setActiveSession(null);
    }
  }, [sessions, activeSessionId, setActiveSession]);

  const handleCreate = useCallback(
    async (args: {
      name: string;
      agent_type: string;
      working_dir: string | null;
      startup_command?: string;
      create_worktree?: boolean;
      cost_budget_usd?: number;
    }) => {
      setShowNewModal(false);
      try {
        const session = await createSession(args);
        setActiveSession(session.id);
      } catch (err) {
        console.error("Failed to create session:", err);
      }
    },
    [setActiveSession],
  );

  const handleFork = useCallback(
    async (id: string) => {
      try {
        const session = await forkSession(id);
        setActiveSession(session.id);
      } catch (err) {
        console.error("Failed to fork session:", err);
      }
    },
    [setActiveSession],
  );

  const handleClearDone = useCallback(async () => {
    const doneSessions = sessions.filter((s) => s.status === "DONE");
    for (const s of doneSessions) {
      try {
        await killSession(s.id);
        removeSession(s.id);
      } catch {
        // ignore individual failures
      }
    }
  }, [sessions, removeSession]);

  const handleMarkDone = useCallback(async (id: string) => {
    try {
      await invoke("mark_session_done", { sessionId: id });
    } catch (err) {
      console.error("Failed to mark session done:", err);
    }
  }, []);

  const handleRestart = useCallback(
    async (id: string) => {
      try {
        const session = await invoke<{ id: string }>("restart_session", {
          sessionId: id,
        });
        setActiveSession(session.id);
      } catch (err) {
        console.error("Failed to restart session:", err);
      }
    },
    [setActiveSession],
  );

  const handleKill = useCallback(
    async (id: string) => {
      try {
        await killSession(id);
        removeSession(id);
        if (id === activeSessionId) {
          const remaining = sessions.filter((s) => s.id !== id);
          setActiveSession(remaining.length > 0 ? remaining[0].id : null);
        }
      } catch (err) {
        console.error("Failed to kill session:", err);
      }
    },
    [sessions, activeSessionId, setActiveSession, removeSession],
  );

  // Keyboard shortcuts
  useKeyboardShortcuts({
    sessions,
    activeSessionId,
    onNewSession: () => setShowNewModal(true),
    onTemplates: () => setShowTemplates(true),
    onAutoRespond: () => setShowAutoRespond(true),
    onPalette: () => setShowPalette(true),
    onSearch: () => setShowSearch(true),
    onToggleEventLog: () => setShowEventLog((v) => !v),
    onToggleHelp: () => setShowHelp((v) => !v),
    onJumpNextWaiting: () => {
      const next = nextWaitingSessionId(sessions, activeSessionId);
      if (next) setActiveSession(next);
    },
    onSelectSession: setActiveSession,
    onKill: handleKill,
    onSetLayout: setLayout,
  });

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
      }}
    >
      <SessionSidebar
        sessions={sessions}
        activeId={activeSessionId}
        onSelect={setActiveSession}
        onNewSession={() => setShowNewModal(true)}
        onKill={handleKill}
        onFork={handleFork}
        onMarkDone={handleMarkDone}
        onRestart={handleRestart}
        onClearDone={handleClearDone}
      />

      <ErrorBoundary>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: "var(--bg-primary)",
          }}
        >
          {/* Toolbar */}
          <div
            style={{
              height: 36,
              background: "var(--bg-secondary)",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              padding: "0 12px",
              gap: 10,
              fontSize: 12,
              color: "var(--text-secondary)",
              flexShrink: 0,
            }}
          >
            {layout === "1up" && activeSession && (
              <>
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                  {activeSession.name}
                </span>
                {activeSession.branch && <span>⎇ {activeSession.branch}</span>}
                {activeSession.worktree_path && (
                  <span style={{ fontSize: 11 }}>
                    {activeSession.worktree_path}
                  </span>
                )}
              </>
            )}
            {layout !== "1up" && (
              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                {sessions.length} session{sessions.length !== 1 ? "s" : ""}
              </span>
            )}
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {waitingCount > 0 && (
                <button
                  title={`${waitingCount} session${waitingCount > 1 ? "s" : ""} waiting — Cmd+Shift+A`}
                  onClick={() => {
                    const next = nextWaitingSessionId(
                      sessions,
                      activeSessionId,
                    );
                    if (next) setActiveSession(next);
                  }}
                  className="btn btn-toolbar"
                  style={{
                    background: "var(--yellow)",
                    borderColor: "var(--yellow)",
                    color: "var(--color-paper)",
                    fontWeight: 700,
                  }}
                >
                  {waitingCount} waiting
                </button>
              )}
              {activeSession && (
                <button
                  title="Export session output to ~/Downloads"
                  onClick={() => {
                    invoke<string>("export_session_output", {
                      sessionId: activeSession.id,
                    })
                      .then((path) => setToast(`Saved: ${path}`))
                      .catch((e) => console.error("Export failed:", e));
                  }}
                  className="btn btn-ghost btn-toolbar"
                >
                  ↓ export
                </button>
              )}
              <button
                title="Session templates (Cmd+T)"
                onClick={() => setShowTemplates(true)}
                className="btn btn-ghost btn-toolbar"
              >
                ⬡ templates
              </button>
              <button
                title="Auto-respond patterns (Cmd+Shift+R)"
                onClick={() => setShowAutoRespond(true)}
                className="btn btn-ghost btn-toolbar"
              >
                ⚡ auto
              </button>
              <button
                title="Toggle event log (Cmd+L)"
                onClick={() => setShowEventLog((v) => !v)}
                className="btn btn-ghost btn-toolbar"
                style={
                  showEventLog
                    ? {
                        background: "var(--bg-4)",
                        borderColor: "var(--border-strong)",
                      }
                    : undefined
                }
              >
                ☰ log
              </button>
              <LayoutSwitcher current={layout} onChange={setLayout} />
            </div>
          </div>

          {/* Pane area + optional event log side panel */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
            {layout === "1up" ? (
              sessions.length > 0 ? (
                sessions.map((s) => (
                  <TerminalPane
                    key={s.id}
                    sessionId={s.id}
                    tmuxSession={s.tmux_session}
                    active={s.id === activeSessionId}
                  />
                ))
              ) : (
                <TerminalPane sessionId={null} tmuxSession={null} active />
              )
            ) : (
              <PaneGrid
                sessions={sessions}
                activeId={activeSessionId}
                onActivate={setActiveSession}
                layout={layout}
              />
            )}
            {showEventLog && activeSession && (
              <div
                style={{
                  width: 280,
                  borderLeft: "1px solid var(--border)",
                  background: "var(--bg-secondary)",
                  overflowY: "auto",
                  flexShrink: 0,
                }}
              >
                <EventLog
                  sessionId={activeSession.id}
                  sessionName={activeSession.name}
                  lastActivity={activeSession.last_activity ?? undefined}
                />
              </div>
            )}
          </div>

          {/* Quick commands — shown when active session is WAITING */}
          {activeSession?.status === "WAITING" && (
            <QuickCommands
              onSend={(cmd) => {
                invoke("send_input", {
                  sessionId: activeSession.id,
                  input: cmd,
                }).catch(console.error);
              }}
            />
          )}

          {/* Broadcast bar — only when multiple sessions exist */}
          {sessions.length > 1 && (
            <BroadcastBar
              sessionCount={sessions.length}
              waitingCount={waitingCount}
              onBroadcast={(text) => {
                broadcastInput(text).catch(console.error);
              }}
              onBroadcastWaiting={(text) => {
                const waitingSessions = sessions.filter(
                  (s) => s.status === "WAITING",
                );
                waitingSessions.forEach((s) =>
                  invoke("send_input", {
                    sessionId: s.id,
                    input: text,
                  }).catch(console.error),
                );
              }}
            />
          )}
        </div>
      </ErrorBoundary>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      <NewSessionModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreate={handleCreate}
      />
      <KeyboardHelp open={showHelp} onClose={() => setShowHelp(false)} />
      <AutoResponsePanel
        open={showAutoRespond}
        onClose={() => setShowAutoRespond(false)}
      />
      <TemplatesPanel
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onLaunch={(t) => {
          const base = t.name;
          const dir = t.working_dir;
          for (let i = 1; i <= t.count; i++) {
            const name = t.count > 1 ? `${base}-${i}` : base;
            handleCreate({
              name,
              agent_type: t.agent_type,
              working_dir: dir,
              startup_command: t.startup_command ?? undefined,
              cost_budget_usd:
                t.cost_budget_usd > 0 ? t.cost_budget_usd : undefined,
            });
          }
        }}
      />
      <CommandPalette
        open={showPalette}
        sessions={sessions}
        onSelect={(id) => {
          setActiveSession(id);
          setShowPalette(false);
        }}
        onClose={() => setShowPalette(false)}
      />
      <SearchPanel
        open={showSearch}
        onClose={() => setShowSearch(false)}
        onNavigate={(id) => {
          setActiveSession(id);
          setShowSearch(false);
        }}
      />
    </div>
  );
}
