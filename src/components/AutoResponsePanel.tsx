import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface AutoResponse {
  id: string;
  pattern: string;
  response: string;
  enabled: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AutoResponsePanel({ open, onClose }: Props) {
  const [patterns, setPatterns] = useState<AutoResponse[]>([]);
  const [newPattern, setNewPattern] = useState("");
  const [newResponse, setNewResponse] = useState("");

  useEffect(() => {
    if (!open) return;
    invoke<AutoResponse[]>("list_auto_responses")
      .then(setPatterns)
      .catch((err: unknown) => {
        console.error("Failed to list auto-responses:", err);
        setPatterns([]);
      });
  }, [open]);

  if (!open) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPattern.trim()) return;
    try {
      const updated = await invoke<AutoResponse[]>("add_auto_response", {
        pattern: newPattern.trim(),
        response: newResponse,
      });
      setPatterns(updated);
      setNewPattern("");
      setNewResponse("");
    } catch (err) {
      console.error("Failed to add auto-response:", err);
    }
  };

  const handleDelete = async (id: string) => {
    const updated = await invoke<AutoResponse[]>("delete_auto_response", {
      id,
    });
    setPatterns(updated);
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    const updated = await invoke<AutoResponse[]>("toggle_auto_response", {
      id,
      enabled: !enabled,
    });
    setPatterns(updated);
  };

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(249,248,246,0.7)",
    zIndex: 200,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: 80,
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    color: "var(--text-primary)",
    padding: "6px 10px",
    fontSize: 12,
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        style={{
          width: 540,
          background: "var(--color-paper)",
          border: "0.5px solid var(--color-kage)",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Auto-Response Patterns
            </span>
            <div
              style={{
                fontSize: 10,
                color: "var(--text-secondary)",
                marginTop: 2,
              }}
            >
              When a session is WAITING and its output matches a pattern,
              automatically send the response
            </div>
          </div>
        </div>

        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {patterns.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: "var(--text-secondary)",
                fontSize: 12,
              }}
            >
              No patterns configured. Add one below.
            </div>
          ) : (
            patterns.map((p) => (
              <div
                key={p.id}
                style={{
                  padding: "8px 16px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={() => handleToggle(p.id, p.enabled)}
                  style={{ cursor: "pointer", flexShrink: 0 }}
                />
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-primary)",
                      fontFamily: "monospace",
                    }}
                  >
                    {p.pattern}
                  </span>
                  {p.response ? (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        marginLeft: 8,
                      }}
                    >
                      → "{p.response}"
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        marginLeft: 8,
                      }}
                    >
                      → ↵ (Enter)
                    </span>
                  )}
                </div>
                <button
                  aria-label="delete"
                  onClick={() => handleDelete(p.id)}
                  style={{
                    background: "none",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: 11,
                    padding: "2px 7px",
                  }}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={handleAdd}
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <input
            style={{ ...inputStyle, flex: 2 }}
            placeholder="Pattern (e.g. [y/n])"
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
          />
          <input
            style={{ ...inputStyle, flex: 1 }}
            placeholder="Response (empty = Enter)"
            value={newResponse}
            onChange={(e) => setNewResponse(e.target.value)}
          />
          <button
            type="submit"
            aria-label="add"
            disabled={!newPattern.trim()}
            style={{
              ...inputStyle,
              background: "var(--accent-blue)",
              border: "none",
              color: "var(--color-paper)",
              fontWeight: 600,
              cursor: newPattern.trim() ? "pointer" : "default",
              flexShrink: 0,
              opacity: newPattern.trim() ? 1 : 0.4,
            }}
          >
            Add
          </button>
        </form>

        <div
          style={{
            padding: "6px 16px",
            borderTop: "1px solid var(--border)",
            fontSize: 10,
            color: "var(--text-secondary)",
          }}
        >
          Patterns are checked every 10s against WAITING sessions' last output
          line
        </div>
      </div>
    </div>
  );
}
