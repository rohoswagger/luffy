import { useState } from "react";

interface Props {
  sessionCount: number;
  onBroadcast: (text: string) => void;
}

export function BroadcastBar({ sessionCount, onBroadcast }: Props) {
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim()) return;
    onBroadcast(value);
    setValue("");
  };

  return (
    <div style={{
      height: 36,
      background: "var(--bg-secondary)",
      borderTop: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      padding: "0 12px",
      gap: 8,
      flexShrink: 0,
    }}>
      {/* Icon + label */}
      <span style={{ fontSize: 11, color: "var(--accent-purple)", fontWeight: 700, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
        ⬡ BROADCAST
      </span>

      {/* Session count badge */}
      <span style={{
        fontSize: 10, background: "var(--bg-tertiary)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "1px 6px", color: "var(--text-secondary)",
      }}>
        {sessionCount}
      </span>

      {/* Input */}
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        placeholder="Broadcast to all sessions… (Enter to send)"
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          color: "var(--text-primary)",
          fontSize: 12,
          fontFamily: "inherit",
        }}
      />

      {/* Send button */}
      <button
        onClick={submit}
        title="Send to all sessions"
        style={{
          background: "none",
          border: "1px solid var(--border)",
          borderRadius: 4,
          color: "var(--accent-purple)",
          cursor: "pointer",
          padding: "2px 8px",
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        ↵ ALL
      </button>
    </div>
  );
}
