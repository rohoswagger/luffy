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
import { useSessionStore } from "./store/sessions";
import { invoke } from "@tauri-apps/api/core";
import { useTauriEvents, createSession, killSession, broadcastInput, forkSession } from "./hooks/useTauri";
import { nextWaitingSessionId } from "./utils/sessions";

export default function App() {
  useTauriEvents();

  const { sessions, activeSessionId, setActiveSession, removeSession } = useSessionStore();
  const [showNewModal, setShowNewModal] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showEventLog, setShowEventLog] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAutoRespond, setShowAutoRespond] = useState(false);
  const [layout, setLayout] = useState<Layout>("1up");

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

  const handleCreate = useCallback(async (args: { name: string; agent_type: string; working_dir: string | null; startup_command?: string; create_worktree?: boolean; cost_budget_usd?: number }) => {
    setShowNewModal(false);
    try {
      const session = await createSession(args);
      setActiveSession(session.id);
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  }, [setActiveSession]);

  const handleFork = useCallback(async (id: string) => {
    try {
      const session = await forkSession(id);
      setActiveSession(session.id);
    } catch (err) {
      console.error("Failed to fork session:", err);
    }
  }, [setActiveSession]);

  const handleMarkDone = useCallback(async (id: string) => {
    try {
      await invoke("mark_session_done", { sessionId: id });
    } catch (err) {
      console.error("Failed to mark session done:", err);
    }
  }, []);

  const handleKill = useCallback(async (id: string) => {
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
  }, [sessions, activeSessionId, setActiveSession, removeSession]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key === "n") { e.preventDefault(); setShowNewModal(true); return; }
      if (meta && e.key === "t") { e.preventDefault(); setShowTemplates(true); return; }
      if (meta && e.shiftKey && e.key === "r") { e.preventDefault(); setShowAutoRespond(true); return; }
      if (meta && e.key === "k") { e.preventDefault(); setShowPalette(true); return; }
      if (meta && e.shiftKey && e.key === "f") { e.preventDefault(); setShowSearch(true); return; }
      if (meta && e.key === "l") { e.preventDefault(); setShowEventLog((v) => !v); return; }
      if (meta && e.key === "/") { e.preventDefault(); setShowHelp((v) => !v); return; }
      if (meta && e.shiftKey && e.key === "a") {
        e.preventDefault();
        const next = nextWaitingSessionId(sessions, activeSessionId);
        if (next) setActiveSession(next);
        return;
      }

      if (meta && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const s = sessions[parseInt(e.key, 10) - 1];
        if (s) setActiveSession(s.id);
        return;
      }

      if (meta && e.key === "[") {
        e.preventDefault();
        const idx = sessions.findIndex((s) => s.id === activeSessionId);
        if (idx > 0) setActiveSession(sessions[idx - 1].id);
        return;
      }

      if (meta && e.key === "]") {
        e.preventDefault();
        const idx = sessions.findIndex((s) => s.id === activeSessionId);
        if (idx < sessions.length - 1) setActiveSession(sessions[idx + 1].id);
        return;
      }

      if (meta && e.key === "w" && activeSessionId) {
        e.preventDefault();
        handleKill(activeSessionId);
        return;
      }

      // Cmd+Shift+1/2/4: switch layout
      if (meta && e.shiftKey && e.key === "1") { e.preventDefault(); setLayout("1up"); return; }
      if (meta && e.shiftKey && e.key === "2") { e.preventDefault(); setLayout("2up"); return; }
      if (meta && e.shiftKey && e.key === "4") { e.preventDefault(); setLayout("4up"); return; }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sessions, activeSessionId, setActiveSession, handleKill]);

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden" }}>
      <SessionSidebar
        sessions={sessions}
        activeId={activeSessionId}
        onSelect={setActiveSession}
        onNewSession={() => setShowNewModal(true)}
        onKill={handleKill}
        onFork={handleFork}
        onMarkDone={handleMarkDone}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-primary)" }}>
        {/* Toolbar */}
        <div style={{
          height: 36,
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", padding: "0 12px", gap: 10,
          fontSize: 12, color: "var(--text-secondary)", flexShrink: 0,
        }}>
          {layout === "1up" && activeSession && (
            <>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{activeSession.name}</span>
              {activeSession.branch && <span>⎇ {activeSession.branch}</span>}
              {activeSession.worktree_path && <span style={{ fontSize: 11 }}>{activeSession.worktree_path}</span>}
            </>
          )}
          {layout !== "1up" && (
            <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>
              {sessions.length} session{sessions.length !== 1 ? "s" : ""}
            </span>
          )}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {waitingCount > 0 && (
              <button
                title={`${waitingCount} session${waitingCount > 1 ? "s" : ""} waiting for input — Cmd+Shift+A to jump`}
                onClick={() => {
                  const next = nextWaitingSessionId(sessions, activeSessionId);
                  if (next) setActiveSession(next);
                }}
                style={{ background: "#d29922", border: "none", borderRadius: 4, color: "#000", cursor: "pointer", padding: "2px 8px", fontSize: 11, fontWeight: 700 }}
              >
                {waitingCount} waiting
              </button>
            )}
            {activeSession && (
              <button
                title="Export session output to ~/Downloads"
                onClick={() => {
                  invoke<string>("export_session_output", { sessionId: activeSession.id })
                    .then((path) => alert(`Saved: ${path}`))
                    .catch((e) => console.error("Export failed:", e));
                }}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", cursor: "pointer", padding: "2px 6px", fontSize: 11 }}
              >
                ↓ export
              </button>
            )}
            <button
              title="Session templates"
              onClick={() => setShowTemplates(true)}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", cursor: "pointer", padding: "2px 6px", fontSize: 11 }}
            >
              ⬡ templates
            </button>
            <button
              title="Auto-respond patterns (Cmd+Shift+R)"
              onClick={() => setShowAutoRespond(true)}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", cursor: "pointer", padding: "2px 6px", fontSize: 11 }}
            >
              ⚡ auto
            </button>
            <button
              title="Toggle event log (Cmd+L)"
              onClick={() => setShowEventLog((v) => !v)}
              style={{ background: showEventLog ? "var(--bg-tertiary)" : "none", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", cursor: "pointer", padding: "2px 6px", fontSize: 11 }}
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
            <div style={{ width: 280, borderLeft: "1px solid var(--border)", background: "var(--bg-secondary)", overflowY: "auto", flexShrink: 0 }}>
              <EventLog sessionId={activeSession.id} sessionName={activeSession.name} />
            </div>
          )}
        </div>

        {/* Quick commands — shown when active session is WAITING */}
        {activeSession?.status === "WAITING" && (
          <QuickCommands
            onSend={(cmd) => {
              invoke("send_input", { sessionId: activeSession.id, input: cmd }).catch(console.error);
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
              const waitingSessions = sessions.filter((s) => s.status === "WAITING");
              import("@tauri-apps/api/core").then(({ invoke }) => {
                waitingSessions.forEach((s) => invoke("send_input", { sessionId: s.id, input: text }).catch(console.error));
              });
            }}
          />
        )}
      </div>

      <NewSessionModal open={showNewModal} onClose={() => setShowNewModal(false)} onCreate={handleCreate} />
      <KeyboardHelp open={showHelp} onClose={() => setShowHelp(false)} />
      <AutoResponsePanel open={showAutoRespond} onClose={() => setShowAutoRespond(false)} />
      <TemplatesPanel
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onLaunch={(t) => {
          const base = t.name;
          const dir = t.working_dir;
          for (let i = 1; i <= t.count; i++) {
            const name = t.count > 1 ? `${base}-${i}` : base;
            handleCreate({ name, agent_type: t.agent_type, working_dir: dir, startup_command: t.startup_command ?? undefined });
          }
        }}
      />
      <CommandPalette
        open={showPalette}
        sessions={sessions}
        onSelect={(id) => { setActiveSession(id); setShowPalette(false); }}
        onClose={() => setShowPalette(false)}
      />
      <SearchPanel
        open={showSearch}
        onClose={() => setShowSearch(false)}
        onNavigate={(id) => { setActiveSession(id); setShowSearch(false); }}
      />
    </div>
  );
}
