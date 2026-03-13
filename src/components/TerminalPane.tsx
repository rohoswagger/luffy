import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import "@xterm/xterm/css/xterm.css";

interface Props {
  sessionId: string | null;
  tmuxSession: string | null; // reserved for future reconnect logic
  active: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TerminalPane({ sessionId, tmuxSession: _tmuxSession, active }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!sessionId || !containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: "#0d1117",
        foreground: "#e6edf3",
        cursor: "#58a6ff",
        selectionBackground: "#264f78",
        black: "#484f58",   red: "#ff7b72",  green: "#3fb950",  yellow: "#d29922",
        blue: "#58a6ff",    magenta: "#bc8cff", cyan: "#39c5cf", white: "#b1bac4",
        brightBlack: "#6e7681", brightRed: "#ffa198", brightGreen: "#56d364",
        brightYellow: "#e3b341", brightBlue: "#79c0ff", brightMagenta: "#d2a8ff",
        brightCyan: "#56d4dd", brightWhite: "#f0f6fc",
      },
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
      cursorBlink: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    term.onData((data: string) => {
      invoke("send_input", { sessionId, input: data }).catch(console.error);
    });

    listen<string>(`pty-output-${sessionId}`, (event) => {
      term.write(event.payload);
    }).then((unlisten) => {
      unlistenRef.current = unlisten;
    });

    const observer = new ResizeObserver(() => fitAddon.fit());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      unlistenRef.current?.();
      term.dispose();
      termRef.current = null;
    };
  }, [sessionId]);

  if (!sessionId) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: 13 }}>
        Select a session from the sidebar, or press + to create one.
      </div>
    );
  }

  return (
    <div
      className="terminal-container"
      ref={containerRef}
      style={{ flex: 1, height: "100%", padding: 4, overflow: "hidden", display: active ? "block" : "none" }}
    />
  );
}
