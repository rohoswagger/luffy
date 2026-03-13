import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { StatusBadge } from "./StatusBadge";
import type { SessionData } from "../store/sessions";
import { formatRelativeTime, formatDuration } from "../utils/time";
import { sortSessionsByPriority, isSessionStuck } from "../utils/sessions";
import { AGENT_ICONS as BASE_AGENT_ICONS } from "../constants";
import logoSrc from "../assets/logo.png";

function costColor(cost: number, budget: number): string {
  if (budget > 0) {
    if (cost >= budget) return "var(--red)";
    if (cost >= budget * 0.8) return "var(--yellow)";
  }
  return "var(--green)";
}

const AGENT_ICONS: Record<string, string> = {
  ...BASE_AGENT_ICONS,
  "claude-code": "◆",
  codex: "◈",
};

interface Props {
  sessions: SessionData[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewSession: () => void;
  onKill: (id: string) => void;
  onFork?: (id: string) => void;
  onMarkDone?: (id: string) => void;
  onRestart?: (id: string) => void;
  onClearDone?: () => void;
}

export function SessionSidebar({
  sessions,
  activeId,
  onSelect,
  onNewSession,
  onKill,
  onFork,
  onMarkDone,
  onRestart,
  onClearDone,
}: Props) {
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
    invoke("set_session_note", { sessionId: id, note: noteValue.trim() }).catch(
      console.error,
    );
    setEditingNoteId(null);
  };

  const commitRename = (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      invoke("rename_session", { sessionId: id, newName: trimmed }).catch(
        console.error,
      );
    }
    setRenamingId(null);
  };

  const totalCost = sessions.reduce((sum, s) => sum + s.total_cost_usd, 0);
  const filteredSessions = filter
    ? sessions.filter(
        (s) =>
          s.name.toLowerCase().includes(filter.toLowerCase()) ||
          (s.branch && s.branch.toLowerCase().includes(filter.toLowerCase())) ||
          (s.note && s.note.toLowerCase().includes(filter.toLowerCase())),
      )
    : sessions;
  const sortedSessions = sortSessionsByPriority(filteredSessions);

  return (
    <aside
      style={{
        width: 256,
        background: "var(--bg-2)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <img
            src={logoSrc}
            alt="Luffy"
            style={{ width: 20, height: 20, borderRadius: 4 }}
          />
          <span
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              color: "var(--text-1)",
              letterSpacing: "0.12em",
            }}
          >
            LUFFY
          </span>
        </div>
        <button
          title="New session"
          onClick={onNewSession}
          className="btn btn-ghost"
          style={{ padding: "2px 8px", fontSize: 16, lineHeight: 1 }}
        >
          +
        </button>
      </div>

      {/* Filter */}
      {sessions.length > 0 && (
        <div
          style={{
            padding: "6px 8px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <input
            autoFocus
            className="input input-sm"
            placeholder="Filter…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      )}

      {/* Session list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {sessions.length === 0 && (
          <div
            style={{
              padding: "32px 16px",
              color: "var(--text-3)",
              fontSize: "var(--text-sm)",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            No sessions.
            <br />
            <span style={{ color: "var(--text-2)" }}>Press + to start.</span>
          </div>
        )}

        {sortedSessions.map((session) => (
          <div
            key={session.id}
            data-active={session.id === activeId}
            onClick={() => onSelect(session.id)}
            className="session-item"
          >
            {/* Row 1: agent icon + name + action buttons */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  overflow: "hidden",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--text-3)",
                    flexShrink: 0,
                  }}
                >
                  {AGENT_ICONS[session.agent_type] || "▸"}
                </span>
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
                    className="input input-sm"
                    style={{ width: 140 }}
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => startRename(session, e)}
                    title="Double-click to rename"
                    style={{
                      fontSize: "var(--text-md)",
                      color: "var(--text-1)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {session.name}
                  </span>
                )}
              </div>

              {/* Action buttons — revealed on hover via CSS */}
              <div
                className="session-actions"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  flexShrink: 0,
                }}
              >
                {onMarkDone && !["DONE", "ERROR"].includes(session.status) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkDone(session.id);
                    }}
                    title="Mark as done"
                    aria-label="Mark as done"
                    className="btn-icon"
                  >
                    ✓
                  </button>
                )}
                {onRestart && session.status === "ERROR" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestart(session.id);
                    }}
                    title="Restart session"
                    aria-label="Restart session"
                    className="btn-icon"
                    style={{ color: "var(--yellow)" }}
                  >
                    ↺
                  </button>
                )}
                {onFork && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFork(session.id);
                    }}
                    title="Fork session"
                    aria-label="Fork session"
                    className="btn-icon"
                  >
                    ⊕
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onKill(session.id);
                  }}
                  title="Kill session"
                  aria-label="Kill session"
                  className="btn-icon"
                  style={{ color: "var(--text-3)" }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Row 2: note */}
            {editingNoteId === session.id ? (
              <input
                autoFocus
                value={noteValue}
                placeholder="Add a note…"
                onChange={(e) => setNoteValue(e.target.value)}
                onBlur={() => commitNote(session.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitNote(session.id);
                  if (e.key === "Escape") setEditingNoteId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="input"
                style={{
                  marginTop: 3,
                  fontSize: "var(--text-xs)",
                  padding: "2px 5px",
                }}
              />
            ) : session.note ? (
              <div
                title="Edit note (double-click)"
                onDoubleClick={(e) => startEditNote(session, e)}
                style={{
                  marginTop: 2,
                  fontSize: "var(--text-xs)",
                  color: "var(--text-2)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontStyle: "italic",
                  cursor: "text",
                }}
              >
                {session.note}
              </div>
            ) : (
              <div
                title="Double-click to add note"
                onDoubleClick={(e) => startEditNote(session, e)}
                style={{ height: 4, cursor: "text" }}
              />
            )}

            {/* Row 3: output preview */}
            {session.last_output_preview && (
              <div
                style={{
                  marginTop: 2,
                  fontSize: "var(--text-xs)",
                  color: "var(--text-3)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {session.last_output_preview}
              </div>
            )}

            {/* Row 4: status + meta */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 4,
                flexWrap: "wrap",
              }}
            >
              <StatusBadge status={session.status} />
              {isSessionStuck(session, now) && (
                <span
                  title="No activity for 10+ minutes"
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--yellow)",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                  }}
                >
                  STUCK?
                </span>
              )}
              {session.branch && (
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-3)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 90,
                  }}
                >
                  <span aria-hidden>⎇ </span>
                  {session.branch}
                </span>
              )}
              <span
                style={{
                  marginLeft: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexShrink: 0,
                }}
              >
                {session.total_cost_usd > 0 && (
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: costColor(
                        session.total_cost_usd,
                        session.cost_budget_usd,
                      ),
                    }}
                  >
                    ${session.total_cost_usd.toFixed(2)}
                    {session.cost_budget_usd > 0
                      ? `/$${session.cost_budget_usd.toFixed(2)}`
                      : ""}
                  </span>
                )}
                {["THINKING", "WAITING"].includes(session.status) &&
                session.created_at ? (
                  <span
                    title={`Running since ${new Date(session.created_at).toLocaleTimeString()}`}
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-3)",
                    }}
                  >
                    {formatDuration(session.created_at, now)}
                  </span>
                ) : session.last_activity ? (
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-3)",
                    }}
                  >
                    {formatRelativeTime(session.last_activity, now)}
                  </span>
                ) : null}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "8px 14px",
          borderTop: "1px solid var(--border)",
          fontSize: "var(--text-xs)",
          color: "var(--text-2)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>
          {sessions.length} session{sessions.length !== 1 ? "s" : ""}
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {sessions.some((s) => s.status === "DONE") && (
            <button
              title="Clear done sessions"
              onClick={() => onClearDone?.()}
              className="btn btn-ghost"
              style={{ padding: "1px 6px", fontSize: "var(--text-xs)" }}
            >
              × done
            </button>
          )}
          {totalCost > 0 && (
            <span style={{ color: "var(--green)" }}>
              total ${totalCost.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
