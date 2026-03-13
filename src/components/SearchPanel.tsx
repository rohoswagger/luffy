import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface SearchResult {
  session_id: string;
  session_name: string;
  line_number: number;
  excerpt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (sessionId: string) => void;
}

export function SearchPanel({ open, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (open) {
      mountedRef.current = true;
      setQuery("");
      setResults([]);
      setSearched(false);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [open]);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      if (mountedRef.current) {
        setResults([]);
        setSearched(false);
      }
      return;
    }
    try {
      const res = await invoke<SearchResult[]>("search_output", { query: q });
      if (mountedRef.current) {
        setResults(res);
        setSearched(true);
      }
    } catch (err) {
      console.error("Search failed:", err);
      if (mountedRef.current) {
        setResults([]);
        setSearched(true);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), 200);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  if (!open) return null;

  // Group results by session
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.session_id] ??= []).push(r);
    return acc;
  }, {});

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search Output"
        className="panel-box"
        style={{
          width: 620,
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
        }}
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
            flexShrink: 0,
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
            placeholder="Search output across all sessions…"
          />
          {results.length > 0 && (
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              {results.length} match{results.length !== 1 ? "es" : ""}
            </span>
          )}
          <span className="kbd-hint" style={{ padding: "2px 5px" }}>
            ESC
          </span>
        </div>

        {/* Results */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {searched && results.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                color: "var(--text-secondary)",
                fontSize: 12,
                textAlign: "center",
              }}
            >
              No matches for "{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([sessionId, rows]) => (
              <div key={sessionId}>
                <div
                  style={{
                    padding: "6px 14px",
                    background: "var(--bg-primary)",
                    fontSize: 11,
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {rows[0].session_name}
                </div>
                {rows.map((r) => (
                  <div
                    key={`${r.session_id}-${r.line_number}`}
                    className="search-result-item"
                    onClick={() => {
                      onNavigate(r.session_id);
                      onClose();
                    }}
                    style={{
                      padding: "8px 14px",
                      borderBottom: "1px solid var(--border)",
                      display: "flex",
                      gap: 10,
                      alignItems: "baseline",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--text-secondary)",
                        minWidth: 40,
                        textAlign: "right",
                      }}
                    >
                      :{r.line_number}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text-primary)",
                        fontFamily: "monospace",
                        whiteSpace: "pre",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {r.excerpt}
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
