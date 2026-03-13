import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { StatusBadge } from "./StatusBadge";
import type { SessionData } from "../store/sessions";
import { formatRelativeTime, formatDuration } from "../utils/time";
import { sortSessionsByPriority, isSessionStuck } from "../utils/sessions";

interface Props {
  sessions: SessionData[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewSession: () => void;
  onKill: (id: string) => void;
  onFork?: (id: string) => void;
  onMarkDone?: (id: string) => void;
  onRestart?: (id: string) => void;
}

const AGENT_ICONS: Record<string, string> = {
  "claude-code": "🤖",
  "aider": "⚡",
  "generic": "▸",
};

export function SessionSidebar({ sessions, activeId, onSelect, onNewSession, onKill, onFork, onMarkDone, onRestart }: Props) {
  const [now, setNow] = useState(new Date());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const startRename = (session: SessionData, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(session.id);
    setRenameValue(session.name);
  };

  const startEditNote = (session: SessionData, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNoteId(session.id);
    setNoteValue(session.note ?? "");
  };

  const commitNote = (id: string) => {
    invoke("set_session_note", { sessionId: id, note: noteValue.trim() }).catch(console.error);
    setEditingNoteId(null);
  };

  const commitRename = (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      invoke("rename_session", { sessionId: id, newName: trimmed }).catch(console.error);
    }
    setRenamingId(null);
  };

  const totalCost = sessions.reduce((sum, s) => sum + s.total_cost_usd, 0);
  const filteredSessions = filter
    ? sessions.filter((s) => s.name.toLowerCase().includes(filter.toLowerCase()) || (s.branch && s.branch.toLowerCase().includes(filter.toLowerCase())))
    : sessions;
  const sortedSessions = sortSessionsByPriority(filteredSessions);

  return (
    <aside style={{
      width: 260,
      background: "var(--bg-secondary)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      flexShrink: 0,
    }}>
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.05em" }}>
          LUFFY
        </span>
        <button
          title="New session"
          onClick={onNewSession}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 4,
            color: "var(--text-primary)",
            cursor: "pointer",
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
          }}
        >
          +
        </button>
      </div>

      {sessions.length > 0 && (
        <div style={{ padding: "4px 8px", borderBottom: "1px solid var(--border)" }}>
          <input
            placeholder="Filter sessions..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ width: "100%", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-primary)", padding: "4px 8px", fontSize: 11 }}
          />
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {sessions.length === 0 && (
          <div style={{ padding: "16px", color: "var(--text-secondary)", fontSize: 12, textAlign: "center" }}>
            No sessions. Press + to start.
          </div>
        )}
        {sortedSessions.map((session) => (
          <div
            key={session.id}
            data-active={session.id === activeId}
            onClick={() => onSelect(session.id)}
            style={{
              padding: "8px 16px",
              cursor: "pointer",
              background: session.id === activeId ? "var(--bg-tertiary)" : "transparent",
              borderLeft: session.id === activeId ? "2px solid var(--accent-blue)" : "2px solid transparent",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                <span style={{ fontSize: 12 }}>{AGENT_ICONS[session.agent_type] || "▸"}</span>
                {renamingId === session.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(session.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(session.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontSize: 12, background: "var(--bg-tertiary)", border: "1px solid var(--accent-blue)", borderRadius: 3, color: "var(--text-primary)", padding: "1px 4px", width: 140 }}
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => startRename(session, e)}
                    title="Double-click to rename"
                    style={{ fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {session.name}
                  </span>
                )}
              </div>
              {onMarkDone && !["DONE", "ERROR"].includes(session.status) && (
                <button
                  onClick={(e) => { e.stopPropagation(); onMarkDone(session.id); }}
                  title="Mark as done"
                  style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12, padding: "0 2px" }}
                >
                  ✓
                </button>
              )}
              {onRestart && session.status === "ERROR" && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRestart(session.id); }}
                  title="Restart session"
                  style={{ background: "none", border: "none", color: "#fbbf24", cursor: "pointer", fontSize: 12, padding: "0 2px" }}
                >
                  ↺
                </button>
              )}
              {onFork && (
                <button
                  onClick={(e) => { e.stopPropagation(); onFork(session.id); }}
                  title="Fork session"
                  style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12, padding: "0 2px" }}
                >
                  ⊕
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onKill(session.id); }}
                title="Kill session"
                style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12, padding: "0 2px" }}
              >
                ✕
              </button>
            </div>
            {editingNoteId === session.id ? (
              <input
                autoFocus
                value={noteValue}
                placeholder="Add a note..."
                onChange={(e) => setNoteValue(e.target.value)}
                onBlur={() => commitNote(session.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitNote(session.id);
                  if (e.key === "Escape") setEditingNoteId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                style={{ fontSize: 10, background: "var(--bg-tertiary)", border: "1px solid var(--accent-blue)", borderRadius: 3, color: "var(--text-primary)", padding: "1px 4px", width: "100%" }}
              />
            ) : session.note ? (
              <div
                title="Edit note"
                onDoubleClick={(e) => startEditNote(session, e)}
                style={{ fontSize: 10, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: "italic", cursor: "text" }}
              >
                {session.note}
              </div>
            ) : (
              <div
                title="Add note (double-click)"
                onDoubleClick={(e) => startEditNote(session, e)}
                style={{ fontSize: 10, color: "transparent", height: 14, cursor: "text" }}
              >
                &nbsp;
              </div>
            )}
            {session.last_output_preview && (
              <div style={{ fontSize: 10, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.7 }}>
                {session.last_output_preview}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusBadge status={session.status} />
              {isSessionStuck(session, now) && (
                <span title="Session may be stuck — no activity for 10+ minutes" style={{ fontSize: 9, color: "#d29922", fontWeight: 700, letterSpacing: "0.05em" }}>
                  STUCK?
                </span>
              )}
              {session.branch && (
                <span style={{ fontSize: 10, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {session.branch}
                </span>
              )}
              {session.total_cost_usd > 0 && (
                <span style={{
                  fontSize: 10,
                  marginLeft: "auto",
                  flexShrink: 0,
                  color: session.cost_budget_usd > 0
                    ? session.total_cost_usd >= session.cost_budget_usd
                      ? "#f87171"
                      : session.total_cost_usd >= session.cost_budget_usd * 0.8
                        ? "#fbbf24"
                        : "#4ade80"
                    : "#4ade80",
                }}>
                  ${session.total_cost_usd.toFixed(2)}{session.cost_budget_usd > 0 ? `/$${session.cost_budget_usd.toFixed(2)}` : ""}
                </span>
              )}
              {["THINKING", "WAITING"].includes(session.status) && session.created_at ? (
                <span title={`Running since ${new Date(session.created_at).toLocaleTimeString()}`} style={{ fontSize: 10, color: "var(--text-secondary)", flexShrink: 0 }}>
                  {formatDuration(session.created_at, now)}
                </span>
              ) : session.last_activity ? (
                <span style={{ fontSize: 10, color: "var(--text-secondary)", flexShrink: 0 }}>
                  {formatRelativeTime(session.last_activity, now)}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)", fontSize: 10, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
        <span>{sessions.length} session{sessions.length !== 1 ? "s" : ""}</span>
        {totalCost > 0 && (
          <span style={{ color: "#4ade80" }}>total ${totalCost.toFixed(2)}</span>
        )}
      </div>
    </aside>
  );
}
