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
export function TerminalPane({
  sessionId,
  tmuxSession: _tmuxSession,
  active,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!sessionId || !containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: "#1a1a1a",
        foreground: "#d4d4d4",
        cursor: "#d0839a",
        selectionBackground: "#3d3535",
        black: "#3a3a3a",
        red: "#c45c55",
        green: "#5a8a62",
        yellow: "#c4a348",
        blue: "#6b8fad",
        magenta: "#8b7caa",
        cyan: "#5a8a8a",
        white: "#b5b0a8",
        brightBlack: "#5a5a5a",
        brightRed: "#d47a74",
        brightGreen: "#72a67a",
        brightYellow: "#d4b85a",
        brightBlue: "#85a8c4",
        brightMagenta: "#a896c0",
        brightCyan: "#74a8a8",
        brightWhite: "#e8e4de",
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

    // Sync PTY size with frontend terminal after fit
    const syncSize = () => {
      const dims = fitAddon.proposeDimensions();
      if (dims) {
        invoke("resize_pty", {
          sessionId,
          rows: dims.rows,
          cols: dims.cols,
        }).catch(console.error);
      }
    };
    syncSize();

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

    const observer = new ResizeObserver(() => {
      fitAddon.fit();
      syncSize();
    });
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
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-ishi)",
          background: "var(--color-paper)",
          fontSize: 13,
        }}
      >
        Select a session from the sidebar, or press + to create one.
      </div>
    );
  }

  return (
    <div
      className="terminal-container"
      ref={containerRef}
      style={{
        flex: 1,
        height: "100%",
        padding: 4,
        overflow: "hidden",
        display: active ? "block" : "none",
        background: "#1a1a1a",
      }}
    />
  );
}
