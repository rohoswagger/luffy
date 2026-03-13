import React from "react";
import type { SessionData } from "../store/sessions";

interface Props {
  status: SessionData["status"];
}

const STATUS_CONFIG: Record<
  SessionData["status"],
  { color: string; pulse: boolean; label: string }
> = {
  THINKING: { color: "#bc8cff", pulse: true, label: "THINKING" },
  WAITING: { color: "#d29922", pulse: true, label: "WAITING" },
  IDLE: { color: "#8b949e", pulse: false, label: "IDLE" },
  ERROR: { color: "#f85149", pulse: false, label: "ERROR" },
  DONE: { color: "#3fb950", pulse: false, label: "DONE" },
};

export const StatusBadge = React.memo(function StatusBadge({ status }: Props) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
      }}
    >
      <span
        className={`status-dot ${cfg.pulse ? "animate-pulse" : ""}`}
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: cfg.color,
          display: "inline-block",
        }}
      />
      <span style={{ color: cfg.color }}>{cfg.label}</span>
    </span>
  );
});
