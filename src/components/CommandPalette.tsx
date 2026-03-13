import { useState, useRef, useEffect, useMemo } from "react";
import { StatusBadge } from "./StatusBadge";
import type { SessionData } from "../store/sessions";
import { sortSessionsByPriority } from "../utils/sessions";
import { AGENT_ICONS } from "../constants";

interface Props {
  open: boolean;
  sessions: SessionData[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

function fuzzyMatch(query: string, session: SessionData): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    session.name.toLowerCase().includes(q) ||
    (session.branch?.toLowerCase().includes(q) ?? false) ||
    (session.worktree_path?.toLowerCase().includes(q) ?? false) ||
    session.agent_type.includes(q)
  );
}

export function CommandPalette({ open, sessions, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => sortSessionsByPriority(sessions.filter((s) => fuzzyMatch(query, s))),
    [sessions, query],
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => (i + 1) % Math.max(filtered.length, 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(
        (i) =>
          (i - 1 + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1),
      );
      return;
    }
    if (e.key === "Enter" && filtered.length > 0) {
      const idx = Math.min(selectedIdx, filtered.length - 1);
      onSelect(filtered[idx].id);
      onClose();
    }
  };

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        className="panel-box"
        style={{ width: 560 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 14px",
            borderBottom: "1px solid var(--border)",
            gap: 8,
          }}
        >
          <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            ⌕
          </span>
          <input
            ref={inputRef}
            className="input-ghost"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search sessions by name, branch, or type…"
          />
          <span className="kbd-hint" style={{ padding: "2px 5px" }}>
            ESC
          </span>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                color: "var(--text-secondary)",
                fontSize: 12,
                textAlign: "center",
              }}
            >
              No sessions match "{query}"
            </div>
          ) : (
            filtered.map((session, idx) => (
              <div
                key={session.id}
                onClick={() => {
                  onSelect(session.id);
                  onClose();
                }}
                style={{
                  padding: "10px 14px",
                  cursor: "pointer",
                  background:
                    idx === selectedIdx ? "var(--bg-tertiary)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  borderBottom: "1px solid var(--border)",
                }}
                onMouseEnter={() => setSelectedIdx(idx)}
              >
                <span style={{ fontSize: 14 }}>
                  {AGENT_ICONS[session.agent_type]}
                </span>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--text-primary)",
                      fontWeight: 500,
                    }}
                  >
                    {session.name}
                  </div>
                  {session.branch && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        marginTop: 1,
                      }}
                    >
                      ⎇ {session.branch}
                    </div>
                  )}
                </div>
                <StatusBadge status={session.status} />
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: "6px 14px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 12,
            fontSize: 10,
            color: "var(--text-secondary)",
          }}
        >
          {filtered.length > 0 && (
            <>
              <span>
                <kbd className="kbd-hint">↵</kbd> open
              </span>
              <span>
                <kbd className="kbd-hint">↑↓</kbd> navigate
              </span>
            </>
          )}
          <span>
            <kbd className="kbd-hint">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
