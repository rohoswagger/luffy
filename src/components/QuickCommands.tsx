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

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-2)",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: "var(--text-xs)",
          color: "var(--text-3)",
          marginRight: 2,
          flexShrink: 0,
        }}
      >
        ⚡
      </span>
      {commands.map((cmd) => (
        <button
          key={cmd}
          aria-label={cmd}
          onClick={() => onSend(`${cmd}\n`)}
          className="btn btn-ghost btn-toolbar"
        >
          {cmd}
        </button>
      ))}
      <button
        aria-label="^C (interrupt)"
        title="Send Ctrl+C to interrupt"
        onClick={() => onSend(RAW_COMMANDS["__ctrl_c"].raw)}
        className="btn btn-danger btn-toolbar"
      >
        ^C
      </button>
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
        className="input input-sm"
        style={{ width: 120 }}
      />
    </div>
  );
}
