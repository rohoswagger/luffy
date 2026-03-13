import { useState, useEffect, useRef } from "react";
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
  StatusChanged: "var(--status-thinking)",
  CostUpdated: "var(--status-done)",
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
  const lastFetchRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSessionIdRef = useRef<string>(sessionId);

  const THROTTLE_MS = 10_000;

  useEffect(() => {
    const sessionChanged = prevSessionIdRef.current !== sessionId;
    prevSessionIdRef.current = sessionId;

    // Reset throttle when switching sessions so first fetch is immediate
    if (sessionChanged) {
      lastFetchRef.current = 0;
    }

    function doFetch() {
      lastFetchRef.current = Date.now();
      invoke<SessionEventData[]>("get_session_events", { sessionId })
        .then((evs) => {
          setEvents(evs);
          setLoaded(true);
        })
        .catch((err: unknown) => {
          console.error("Failed to fetch session events:", err);
          setLoaded(true);
        });
    }

    const elapsed = Date.now() - lastFetchRef.current;

    if (elapsed >= THROTTLE_MS) {
      setLoaded(false);
      doFetch();
    } else {
      // Schedule a fetch for when the throttle window expires
      if (timerRef.current === null) {
        const remaining = THROTTLE_MS - elapsed;
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          doFetch();
        }, remaining);
      }
    }

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
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
