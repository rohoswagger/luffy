import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { formatRelativeTime } from "../utils/time";

interface EventKind {
  type: "Created" | "StatusChanged" | "CostUpdated";
  data?: { from?: string; to?: string; cost_usd?: number };
}

interface SessionEventData {
  timestamp: string;
  kind: EventKind;
}

interface Props {
  sessionId: string;
  sessionName: string;
  lastActivity?: string;
}

const EVENT_COLORS: Record<string, string> = {
  Created: "var(--text-secondary)",
  StatusChanged: "var(--accent-blue)",
  CostUpdated: "#4ade80",
};

function renderKind(kind: EventKind): string {
  switch (kind.type) {
    case "Created":
      return "Created";
    case "StatusChanged":
      return `${kind.data?.from} → ${kind.data?.to}`;
    case "CostUpdated":
      return `Cost $${kind.data?.cost_usd?.toFixed(3)}`;
    default:
      return kind.type;
  }
}

export function EventLog({ sessionId, sessionName, lastActivity }: Props) {
  const [events, setEvents] = useState<SessionEventData[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    invoke<SessionEventData[]>("get_session_events", { sessionId })
      .then((evs) => {
        setEvents(evs);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [sessionId, lastActivity]);

  return (
    <div style={{ padding: "12px 0", fontFamily: "inherit" }}>
      <div
        style={{
          padding: "0 14px 8px",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-secondary)",
          letterSpacing: "0.05em",
        }}
      >
        EVENT LOG — {sessionName}
      </div>
      {!loaded ? (
        <div
          style={{
            padding: "8px 14px",
            color: "var(--text-secondary)",
            fontSize: 12,
          }}
        >
          Loading…
        </div>
      ) : events.length === 0 ? (
        <div
          style={{
            padding: "8px 14px",
            color: "var(--text-secondary)",
            fontSize: 12,
          }}
        >
          No events recorded.
        </div>
      ) : (
        [...events].reverse().map((ev, i) => (
          <div
            key={i}
            style={{
              padding: "4px 14px",
              display: "flex",
              gap: 10,
              alignItems: "baseline",
              borderBottom: "1px solid var(--border)",
              fontSize: 12,
            }}
          >
            <span
              style={{
                color: "var(--text-secondary)",
                fontSize: 10,
                minWidth: 60,
                flexShrink: 0,
              }}
            >
              {formatRelativeTime(ev.timestamp)}
            </span>
            <span
              style={{
                color: EVENT_COLORS[ev.kind.type] ?? "var(--text-primary)",
              }}
            >
              {renderKind(ev.kind)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
