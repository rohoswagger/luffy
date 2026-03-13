import { useState } from "react";

const DEFAULT_COMMANDS = ["y", "n", "continue", "exit"];

// Special commands that are sent as-is without appending "\n"
const RAW_COMMANDS: Record<string, { label: string; raw: string }> = {
  __ctrl_c: { label: "^C", raw: "\x03" },
};

interface Props {
  onSend: (cmd: string) => void;
  commands?: string[];
}

export function QuickCommands({ onSend, commands = DEFAULT_COMMANDS }: Props) {
  const [custom, setCustom] = useState("");

  const sendCustom = () => {
    if (!custom.trim()) return;
    onSend(`${custom}\n`);
    setCustom("");
  };

  const btnStyle: React.CSSProperties = {
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: 3,
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontSize: 11,
    padding: "2px 8px",
    fontFamily: "monospace",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-secondary)",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: "var(--text-secondary)",
          marginRight: 4,
          flexShrink: 0,
        }}
      >
        ⚡ quick
      </span>
      {commands.map((cmd) => (
        <button
          key={cmd}
          aria-label={cmd}
          onClick={() => onSend(`${cmd}\n`)}
          style={btnStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text-primary)";
            e.currentTarget.style.borderColor = "var(--accent-blue)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-secondary)";
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        >
          {cmd}
        </button>
      ))}
      {/* Ctrl+C — always shown to allow interrupting any agent */}
      <button
        key="__ctrl_c"
        aria-label="^C (interrupt)"
        title="Send Ctrl+C to interrupt"
        onClick={() => onSend(RAW_COMMANDS["__ctrl_c"].raw)}
        style={{ ...btnStyle, color: "#f87171", borderColor: "#7f1d1d" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#fca5a5";
          e.currentTarget.style.borderColor = "#f87171";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "#f87171";
          e.currentTarget.style.borderColor = "#7f1d1d";
        }}
      >
        ^C
      </button>
      {/* Custom input */}
      <input
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            sendCustom();
          }
        }}
        placeholder="custom…"
        style={{
          background: "var(--bg-primary)",
          border: "1px solid var(--border)",
          borderRadius: 3,
          color: "var(--text-primary)",
          fontSize: 11,
          fontFamily: "monospace",
          padding: "2px 6px",
          width: 120,
          outline: "none",
        }}
      />
    </div>
  );
}
