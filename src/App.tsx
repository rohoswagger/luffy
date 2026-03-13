import {
  lazy,
  Suspense,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { SessionSidebar } from "./components/SessionSidebar";
import { TerminalPane } from "./components/TerminalPane";
import { PaneGrid } from "./components/PaneGrid";
import type { Layout } from "./components/PaneGrid";
import { BroadcastBar } from "./components/BroadcastBar";
import { EventLog } from "./components/EventLog";
import { QuickCommands } from "./components/QuickCommands";
import { Toast } from "./components/Toast";
import { ErrorBoundary } from "./components/ErrorBoundary";

const NewSessionModal = lazy(() =>
  import("./components/NewSessionModal").then((m) => ({
    default: m.NewSessionModal,
  })),
);
const CommandPalette = lazy(() =>
  import("./components/CommandPalette").then((m) => ({
    default: m.CommandPalette,
  })),
);
const SearchPanel = lazy(() =>
  import("./components/SearchPanel").then((m) => ({
    default: m.SearchPanel,
  })),
);
const KeyboardHelp = lazy(() =>
  import("./components/KeyboardHelp").then((m) => ({
    default: m.KeyboardHelp,
  })),
);
const TemplatesPanel = lazy(() =>
  import("./components/TemplatesPanel").then((m) => ({
    default: m.TemplatesPanel,
  })),
);
const AutoResponsePanel = lazy(() =>
  import("./components/AutoResponsePanel").then((m) => ({
    default: m.AutoResponsePanel,
  })),
);
import { useSessionStore } from "./store/sessions";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  useTauriEvents,
  createSession,
  killSession,
  broadcastInput,
  forkSession,
} from "./hooks/useTauri";
import { nextWaitingSessionId } from "./utils/sessions";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { StatusBadge } from "./components/StatusBadge";
import { formatDuration } from "./utils/time";
import logoSrc from "./assets/logo.png";

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
  const [showSidebar, setShowSidebar] = useState(false);
  const [layout, setLayout] = useState<Layout>("1up");
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const sidebarRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const waitingCount = sessions.filter((s) => s.status === "WAITING").length;

  // Clock for status bar durations
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Auto-select: pick first session if none selected, or if active session was removed
  useEffect(() => {
    const activeExists = sessions.some((s) => s.id === activeSessionId);
    if ((!activeSessionId || !activeExists) && sessions.length > 0) {
      setActiveSession(sessions[0].id);
    } else if (!activeExists && sessions.length === 0) {
      setActiveSession(null);
    }
  }, [sessions, activeSessionId, setActiveSession]);

  // Close sidebar when clicking outside
  useEffect(() => {
    if (!showSidebar) return;
    const handler = (e: MouseEvent) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node)
      ) {
        setShowSidebar(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSidebar]);

  // Instant session creation — no modal, just a terminal
  const handleQuickCreate = useCallback(async () => {
    const name = `agent-${sessions.length + 1}`;
    try {
      const session = await createSession({
        name,
        agent_type: "claude-code",
        working_dir: null,
        startup_command: "claude",
      });
      setActiveSession(session.id);
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  }, [sessions, setActiveSession]);

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
    onNewSession: handleQuickCreate,
    onNewSessionAdvanced: () => setShowNewModal(true),
    onTemplates: () => setShowTemplates(true),
    onAutoRespond: () => setShowAutoRespond(true),
    onPalette: () => setShowPalette(true),
    onSearch: () => setShowSearch(true),
    onToggleSidebar: () => setShowSidebar((v) => !v),
    onToggleEventLog: () => setShowEventLog((v) => !v),
    onToggleHelp: () => setShowHelp((v) => !v),
    onJumpNextWaiting: () => {
      const next = nextWaitingSessionId(sessions, activeSessionId);
      if (next) setActiveSession(next);
    },
    onSelectSession: setActiveSession,
    onKill: handleKill,
    onSetLayout: setLayout,
    onEscape: () => {
      setShowNewModal(false);
      setShowPalette(false);
      setShowSearch(false);
      setShowHelp(false);
      setShowTemplates(false);
      setShowAutoRespond(false);
      setShowSidebar(false);
      setShowEventLog(false);
    },
  });

  // Listen for native menu actions (macOS intercepts Cmd+N/W/T at OS level)
  useEffect(() => {
    const unlisten = listen<string>("menu-action", (event) => {
      switch (event.payload) {
        case "new-session":
          handleQuickCreate();
          break;
        case "new-session-advanced":
          setShowNewModal(true);
          break;
        case "kill-session":
          if (activeSessionId) handleKill(activeSessionId);
          break;
        case "templates":
          setShowTemplates(true);
          break;
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [handleQuickCreate, handleKill, activeSessionId]);

  const totalCost = sessions.reduce((sum, s) => sum + s.total_cost_usd, 0);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Sidebar overlay — triggered by Cmd+B */}
      {showSidebar && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.08)",
              zIndex: 90,
            }}
          />
          <div
            ref={sidebarRef}
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              bottom: 0,
              zIndex: 91,
              animation: "sidebar-in 150ms ease-out",
            }}
          >
            <SessionSidebar
              sessions={sessions}
              activeId={activeSessionId}
              onSelect={(id) => {
                setActiveSession(id);
                setShowSidebar(false);
              }}
              onNewSession={handleQuickCreate}
              onKill={handleKill}
              onFork={handleFork}
              onMarkDone={handleMarkDone}
              onRestart={handleRestart}
              onClearDone={handleClearDone}
            />
          </div>
        </>
      )}

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
          {/* Terminal fills entire window */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
            {layout === "1up" ? (
              activeSession ? (
                <TerminalPane
                  key={activeSession.id}
                  sessionId={activeSession.id}
                  tmuxSession={activeSession.tmux_session}
                  active
                />
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--color-paper)",
                    color: "var(--color-ishi)",
                    gap: 16,
                  }}
                >
                  <img
                    src={logoSrc}
                    alt="Luffy"
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "var(--r-lg)",
                    }}
                  />
                  <span style={{ fontSize: "var(--text-sm)" }}>
                    Press{" "}
                    <kbd
                      style={{
                        padding: "1px 5px",
                        border: "0.5px solid var(--color-kage)",
                        borderRadius: "var(--r-sm)",
                        fontSize: "var(--text-xs)",
                        background: "var(--color-paper-warm)",
                      }}
                    >
                      ⌘N
                    </kbd>{" "}
                    to start a session
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-kumo)",
                    }}
                  >
                    ⌘⇧N advanced · ⌘T templates · ⌘K palette · ⌘/ help
                  </span>
                </div>
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

          {/* Minimal bottom status bar */}
          {sessions.length > 0 && (
            <div
              style={{
                height: 28,
                background: "var(--color-paper-warm)",
                borderTop: "0.5px solid var(--color-kage)",
                display: "flex",
                alignItems: "center",
                padding: "0 12px",
                gap: 12,
                fontSize: "var(--text-xs)",
                color: "var(--color-ishi)",
                flexShrink: 0,
                letterSpacing: "0.02em",
              }}
            >
              {/* Session tabs */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  overflow: "hidden",
                  flex: 1,
                }}
              >
                {sessions.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSession(s.id)}
                    title={`${s.name} — ⌘${i + 1}`}
                    style={{
                      padding: "2px 8px",
                      border: "none",
                      background:
                        s.id === activeSessionId
                          ? "var(--color-kage)"
                          : "transparent",
                      borderRadius: "var(--r-sm)",
                      color:
                        s.id === activeSessionId
                          ? "var(--color-sumi)"
                          : "var(--color-ishi)",
                      fontSize: "var(--text-xs)",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontFamily: "var(--font-sans)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    <StatusBadge status={s.status} />
                    <span
                      style={{
                        maxWidth: 100,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {s.name}
                    </span>
                  </button>
                ))}
              </div>

              {/* Active session info */}
              {activeSession && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  {activeSession.branch && (
                    <span style={{ color: "var(--color-kumo)" }}>
                      ⎇ {activeSession.branch}
                    </span>
                  )}
                  {activeSession.total_cost_usd > 0 && (
                    <span style={{ color: "var(--status-done)" }}>
                      ${activeSession.total_cost_usd.toFixed(2)}
                    </span>
                  )}
                  {["THINKING", "WAITING"].includes(activeSession.status) &&
                    activeSession.created_at && (
                      <span style={{ color: "var(--color-kumo)" }}>
                        {formatDuration(activeSession.created_at, now)}
                      </span>
                    )}
                </div>
              )}

              {/* Right side: aggregate info + sidebar toggle */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                {waitingCount > 0 && (
                  <button
                    onClick={() => {
                      const next = nextWaitingSessionId(
                        sessions,
                        activeSessionId,
                      );
                      if (next) setActiveSession(next);
                    }}
                    style={{
                      padding: "1px 6px",
                      border: "none",
                      background: "var(--status-waiting)",
                      borderRadius: "var(--r-sm)",
                      color: "var(--color-paper)",
                      fontSize: "var(--text-xs)",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                    }}
                    title="Jump to next waiting session (⌘⇧A)"
                  >
                    {waitingCount} waiting
                  </button>
                )}
                {totalCost > 0 && (
                  <span style={{ color: "var(--status-done)" }}>
                    ${totalCost.toFixed(2)}
                  </span>
                )}
                <button
                  onClick={() => setShowSidebar((v) => !v)}
                  title="Toggle sidebar (⌘B)"
                  style={{
                    padding: "1px 5px",
                    border: "none",
                    background: "transparent",
                    color: "var(--color-ishi)",
                    cursor: "pointer",
                    fontSize: "var(--text-sm)",
                    borderRadius: "var(--r-sm)",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  ☰
                </button>
              </div>
            </div>
          )}
        </div>
      </ErrorBoundary>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      <Suspense fallback={null}>
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
      </Suspense>
    </div>
  );
}
