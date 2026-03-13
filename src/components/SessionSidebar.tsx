import { useState, useEffect } from "react";
import { StatusBadge } from "./StatusBadge";
import type { SessionData } from "../store/sessions";
import { formatRelativeTime } from "../utils/time";

interface Props {
  sessions: SessionData[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewSession: () => void;
  onKill: (id: string) => void;
  onFork?: (id: string) => void;
}

const AGENT_ICONS: Record<string, string> = {
  "claude-code": "🤖",
  "aider": "⚡",
  "generic": "▸",
};

export function SessionSidebar({ sessions, activeId, onSelect, onNewSession, onKill, onFork }: Props) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const totalCost = sessions.reduce((sum, s) => sum + s.total_cost_usd, 0);

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

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {sessions.length === 0 && (
          <div style={{ padding: "16px", color: "var(--text-secondary)", fontSize: 12, textAlign: "center" }}>
            No sessions. Press + to start.
          </div>
        )}
        {sessions.map((session) => (
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
                <span style={{ fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {session.name}
                </span>
              </div>
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusBadge status={session.status} />
              {session.branch && (
                <span style={{ fontSize: 10, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {session.branch}
                </span>
              )}
              {session.total_cost_usd > 0 && (
                <span style={{ fontSize: 10, color: "#4ade80", marginLeft: "auto", flexShrink: 0 }}>
                  ${session.total_cost_usd.toFixed(2)}
                </span>
              )}
              {session.last_activity && (
                <span style={{ fontSize: 10, color: "var(--text-secondary)", flexShrink: 0 }}>
                  {formatRelativeTime(session.last_activity, now)}
                </span>
              )}
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
