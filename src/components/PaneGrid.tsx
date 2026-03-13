import { memo } from "react";
import { TerminalPane } from "./TerminalPane";
import { StatusBadge } from "./StatusBadge";
import type { SessionData } from "../store/sessions";
import { AGENT_ICONS } from "../constants";

export type Layout = "1up" | "2up" | "4up";

interface Props {
  sessions: SessionData[];
  activeId: string | null;
  onActivate: (id: string) => void;
  layout: Layout;
}

const GRID_STYLES: Record<Layout, React.CSSProperties> = {
  "1up": {
    display: "grid",
    gridTemplateColumns: "1fr",
    gridTemplateRows: "1fr",
    gap: 2,
  },
  "2up": {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gridTemplateRows: "1fr",
    gap: 2,
  },
  "4up": {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gridTemplateRows: "1fr 1fr",
    gap: 2,
  },
};

const SLOT_COUNTS: Record<Layout, number> = { "1up": 1, "2up": 2, "4up": 4 };

export const PaneGrid = memo(function PaneGrid({ sessions, activeId, onActivate, layout }: Props) {
  const slotCount = SLOT_COUNTS[layout];
  const slots = Array.from(
    { length: slotCount },
    (_, i) => sessions[i] ?? null,
  );

  return (
    <div
      style={{
        ...GRID_STYLES[layout],
        flex: 1,
        overflow: "hidden",
        padding: 2,
      }}
    >
      {slots.map((session, idx) => (
        <div
          key={session?.id ?? `empty-${idx}`}
          className="pane-slot"
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            border:
              session?.id === activeId
                ? "1px solid var(--accent-blue)"
                : "1px solid var(--border)",
            borderRadius: 4,
            background: "var(--bg-primary)",
          }}
        >
          {session ? (
            <>
              {/* Pane header */}
              <div
                onClick={() => onActivate(session.id)}
                style={{
                  height: 28,
                  background:
                    session.id === activeId
                      ? "var(--bg-tertiary)"
                      : "var(--bg-secondary)",
                  display: "flex",
                  alignItems: "center",
                  padding: "0 10px",
                  gap: 8,
                  cursor: "pointer",
                  flexShrink: 0,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span style={{ fontSize: 11 }}>
                  {AGENT_ICONS[session.agent_type]}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-primary)",
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {session.name}
                </span>
                {session.branch && (
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--text-secondary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    ⎇ {session.branch}
                  </span>
                )}
                <span style={{ marginLeft: "auto" }}>
                  <StatusBadge status={session.status} />
                </span>
              </div>
              {/* Terminal */}
              <div style={{ flex: 1, overflow: "hidden" }}>
                <TerminalPane
                  sessionId={session.id}
                  tmuxSession={session.tmux_session}
                  active
                />
              </div>
            </>
          ) : (
            <div
              className="pane-empty"
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
                fontSize: 12,
              }}
            >
              empty slot
            </div>
          )}
        </div>
      ))}
    </div>
  );
});
