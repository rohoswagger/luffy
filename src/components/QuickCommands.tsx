const DEFAULT_COMMANDS = ["y", "n", "continue", "exit"];

interface Props {
  onSend: (cmd: string) => void;
  commands?: string[];
}

export function QuickCommands({ onSend, commands = DEFAULT_COMMANDS }: Props) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 12px",
      borderTop: "1px solid var(--border)",
      background: "var(--bg-secondary)",
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 10, color: "var(--text-secondary)", marginRight: 4, flexShrink: 0 }}>
        ⚡ quick
      </span>
      {commands.map((cmd) => (
        <button
          key={cmd}
          aria-label={cmd}
          onClick={() => onSend(`${cmd}\n`)}
          style={{
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: 11,
            padding: "2px 8px",
            fontFamily: "monospace",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.borderColor = "var(--accent-blue)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.borderColor = "var(--border)"; }}
        >
          {cmd}
        </button>
      ))}
    </div>
  );
}
