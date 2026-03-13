import { useEffect } from "react";
import type { SessionData } from "../store/sessions";
import type { Layout } from "../components/PaneGrid";

export interface KeyboardShortcutOptions {
  sessions: SessionData[];
  activeSessionId: string | null;
  onNewSession: () => void;
  onTemplates: () => void;
  onAutoRespond: () => void;
  onPalette: () => void;
  onSearch: () => void;
  onToggleEventLog: () => void;
  onToggleHelp: () => void;
  onJumpNextWaiting: () => void;
  onSelectSession: (id: string) => void;
  onKill: (id: string) => void;
  onSetLayout: (layout: Layout) => void;
}

export function useKeyboardShortcuts(opts: KeyboardShortcutOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key === "n") {
        e.preventDefault();
        opts.onNewSession();
        return;
      }
      if (meta && e.key === "t") {
        e.preventDefault();
        opts.onTemplates();
        return;
      }
      if (meta && e.shiftKey && e.key === "r") {
        e.preventDefault();
        opts.onAutoRespond();
        return;
      }
      if (meta && e.key === "k") {
        e.preventDefault();
        opts.onPalette();
        return;
      }
      if (meta && e.shiftKey && e.key === "f") {
        e.preventDefault();
        opts.onSearch();
        return;
      }
      if (meta && e.key === "l") {
        e.preventDefault();
        opts.onToggleEventLog();
        return;
      }
      if (meta && e.key === "/") {
        e.preventDefault();
        opts.onToggleHelp();
        return;
      }
      if (meta && e.shiftKey && e.key === "a") {
        e.preventDefault();
        opts.onJumpNextWaiting();
        return;
      }

      // Cmd+Shift+1/2/4: switch layout (must check before Cmd+1-9)
      if (meta && e.shiftKey && e.key === "1") {
        e.preventDefault();
        opts.onSetLayout("1up");
        return;
      }
      if (meta && e.shiftKey && e.key === "2") {
        e.preventDefault();
        opts.onSetLayout("2up");
        return;
      }
      if (meta && e.shiftKey && e.key === "4") {
        e.preventDefault();
        opts.onSetLayout("4up");
        return;
      }

      if (meta && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const s = opts.sessions[parseInt(e.key, 10) - 1];
        if (s) opts.onSelectSession(s.id);
        return;
      }

      if (meta && e.key === "[") {
        e.preventDefault();
        const idx = opts.sessions.findIndex(
          (s) => s.id === opts.activeSessionId,
        );
        if (idx > 0) opts.onSelectSession(opts.sessions[idx - 1].id);
        return;
      }

      if (meta && e.key === "]") {
        e.preventDefault();
        const idx = opts.sessions.findIndex(
          (s) => s.id === opts.activeSessionId,
        );
        if (idx < opts.sessions.length - 1)
          opts.onSelectSession(opts.sessions[idx + 1].id);
        return;
      }

      if (meta && e.key === "w" && opts.activeSessionId) {
        e.preventDefault();
        opts.onKill(opts.activeSessionId);
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [opts]);
}
