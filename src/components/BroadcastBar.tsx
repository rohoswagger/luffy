import { memo, useState } from "react";

interface Props {
  sessionCount: number;
  waitingCount?: number;
  onBroadcast: (text: string) => void;
  onBroadcastWaiting?: (text: string) => void;
}

export const BroadcastBar = memo(function BroadcastBar({
  sessionCount,
  waitingCount,
  onBroadcast,
  onBroadcastWaiting,
}: Props) {
  const [value, setValue] = useState("");
  const [collapsed, setCollapsed] = useState(true);

  const submit = () => {
    if (!value.trim()) return;
    onBroadcast(value);
    setValue("");
    setCollapsed(true);
  };

  const submitWaiting = () => {
    if (!value.trim() || !onBroadcastWaiting) return;
    onBroadcastWaiting(value);
    setValue("");
    setCollapsed(true);
  };

  if (collapsed) {
    return (
      <div
        style={{
          height: 28,
          background: "var(--bg-2)",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          flexShrink: 0,
          cursor: "pointer",
        }}
        onClick={() => setCollapsed(false)}
      >
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--purple)",
            fontWeight: 700,
            letterSpacing: "0.06em",
            whiteSpace: "nowrap",
          }}
        >
          ⬡ BROADCAST ({sessionCount})
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        height: 34,
        background: "var(--bg-2)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        gap: 8,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: "var(--text-xs)",
          color: "var(--purple)",
          fontWeight: 700,
          letterSpacing: "0.06em",
          whiteSpace: "nowrap",
          cursor: "pointer",
        }}
        onClick={() => setCollapsed(true)}
      >
        ⬡ BROADCAST
      </span>
      <span
        style={{
          fontSize: "var(--text-xs)",
          background: "var(--bg-3)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-pill)",
          padding: "1px 6px",
          color: "var(--text-2)",
        }}
      >
        {sessionCount}
      </span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setCollapsed(true);
          }
        }}
        placeholder="Broadcast to all sessions… (Enter)"
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          color: "var(--text-1)",
          fontSize: "var(--text-base)",
          fontFamily: "inherit",
        }}
      />
      {waitingCount && waitingCount > 0 && onBroadcastWaiting && (
        <button
          onClick={submitWaiting}
          title={`Send to waiting sessions (${waitingCount})`}
          className="btn"
          style={{
            background: "var(--yellow)",
            borderColor: "var(--yellow)",
            color: "var(--color-paper)",
            fontWeight: 700,
            padding: "2px 8px",
            fontSize: "var(--text-xs)",
          }}
        >
          ↵ {waitingCount} waiting
        </button>
      )}
      <button
        onClick={submit}
        title="Send to all sessions"
        className="btn btn-ghost"
        style={{
          padding: "2px 8px",
          fontSize: "var(--text-xs)",
          color: "var(--purple)",
          borderColor: "var(--purple)",
        }}
      >
        ↵ all
      </button>
    </div>
  );
});
