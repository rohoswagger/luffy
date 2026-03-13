import { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  {
    group: "Sessions",
    items: [
      { keys: "Cmd+N", desc: "New session (instant)" },
      { keys: "Cmd+Shift+N", desc: "New session (advanced options)" },
      { keys: "Cmd+W", desc: "Kill active session" },
      { keys: "Cmd+D", desc: "Mark active session as done" },
      { keys: "Cmd+E", desc: "Export active session output" },
      { keys: "Cmd+1–9", desc: "Switch to session by index" },
      { keys: "Cmd+[ / ]", desc: "Cycle sessions" },
    ],
  },
  {
    group: "Search & Navigation",
    items: [
      { keys: "Cmd+K", desc: "Command palette (fuzzy session search)" },
      { keys: "Cmd+Shift+F", desc: "Search output across all sessions" },
      {
        keys: "Cmd+Shift+A",
        desc: "Jump to next WAITING session (needs input)",
      },
    ],
  },
  {
    group: "Layout",
    items: [
      { keys: "Cmd+B", desc: "Toggle sidebar" },
      { keys: "Cmd+Shift+1", desc: "1-pane layout" },
      { keys: "Cmd+Shift+2", desc: "2-pane layout" },
      { keys: "Cmd+Shift+4", desc: "4-pane layout" },
    ],
  },
  {
    group: "Panels",
    items: [
      { keys: "Cmd+T", desc: "Session templates" },
      { keys: "Cmd+Shift+R", desc: "Auto-respond patterns" },
      { keys: "Cmd+L", desc: "Toggle event log panel" },
      { keys: "Cmd+?", desc: "This help" },
    ],
  },
];

export function KeyboardHelp({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="panel-overlay"
      style={{ alignItems: "center", paddingTop: 0, zIndex: 300 }}
      onClick={onClose}
    >
      <div
        className="panel-box"
        style={{
          padding: 24,
          width: 500,
          maxHeight: "80vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 16,
          }}
        >
          Keyboard Shortcuts
        </h2>
        {SHORTCUTS.map(({ group, items }) => (
          <div key={group} style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "var(--text-secondary)",
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              {group.toUpperCase()}
            </div>
            {items.map(({ keys, desc }) => (
              <div
                key={keys}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "4px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-primary)" }}>
                  {desc}
                </span>
                <kbd
                  className="kbd-hint"
                  style={{
                    fontSize: 11,
                    background: "var(--bg-tertiary)",
                    padding: "1px 6px",
                    fontFamily: "monospace",
                  }}
                >
                  {keys}
                </kbd>
              </div>
            ))}
          </div>
        ))}
        <div
          style={{
            fontSize: 10,
            color: "var(--text-secondary)",
            textAlign: "center",
            marginTop: 8,
          }}
        >
          Press Esc to close
        </div>
      </div>
    </div>
  );
}
