import React from "react";
import type { SessionData } from "../store/sessions";

interface Props {
  status: SessionData["status"];
}

const STATUS_CONFIG: Record<
  SessionData["status"],
  { color: string; pulse: boolean; label: string }
> = {
  THINKING: { color: "#8b7caa", pulse: true, label: "THINKING" },
  WAITING: { color: "#c4a348", pulse: true, label: "WAITING" },
  IDLE: { color: "#b5b0a8", pulse: false, label: "IDLE" },
  ERROR: { color: "#c45c55", pulse: false, label: "ERROR" },
  DONE: { color: "#5a8a62", pulse: false, label: "DONE" },
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
