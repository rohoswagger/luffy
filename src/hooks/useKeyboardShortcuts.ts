import { useEffect, useRef } from "react";
import type { SessionData } from "../store/sessions";
import type { Layout } from "../components/PaneGrid";

export interface KeyboardShortcutOptions {
  sessions: SessionData[];
  activeSessionId: string | null;
  onNewSession: () => void;
  onNewSessionAdvanced: () => void;
  onTemplates: () => void;
  onAutoRespond: () => void;
  onPalette: () => void;
  onSearch: () => void;
  onToggleSidebar: () => void;
  onToggleEventLog: () => void;
  onToggleHelp: () => void;
  onJumpNextWaiting: () => void;
  onSelectSession: (id: string) => void;
  onKill: (id: string) => void;
  onMarkDone: (id: string) => void;
  onExport: (id: string) => void;
  onSetLayout: (layout: Layout) => void;
  onEscape: () => void;
}

export function useKeyboardShortcuts(opts: KeyboardShortcutOptions) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const o = optsRef.current;

      if (e.key === "Escape") {
        o.onEscape();
        return;
      }

      const meta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (meta && e.shiftKey && key === "n") {
        e.preventDefault();
        o.onNewSessionAdvanced();
        return;
      }
      if (meta && key === "n") {
        e.preventDefault();
        o.onNewSession();
        return;
      }
      if (meta && key === "t") {
        e.preventDefault();
        o.onTemplates();
        return;
      }
      if (meta && key === "b") {
        e.preventDefault();
        o.onToggleSidebar();
        return;
      }
      if (meta && e.shiftKey && key === "r") {
        e.preventDefault();
        o.onAutoRespond();
        return;
      }
      if (meta && key === "k") {
        e.preventDefault();
        o.onPalette();
        return;
      }
      if (meta && e.shiftKey && key === "f") {
        e.preventDefault();
        o.onSearch();
        return;
      }
      if (meta && key === "l") {
        e.preventDefault();
        o.onToggleEventLog();
        return;
      }
      if (meta && e.key === "/") {
        e.preventDefault();
        o.onToggleHelp();
        return;
      }
      if (meta && e.shiftKey && key === "a") {
        e.preventDefault();
        o.onJumpNextWaiting();
        return;
      }

      // Cmd+Shift+1/2/4: switch layout (must check before Cmd+1-9)
      if (meta && e.shiftKey && e.key === "1") {
        e.preventDefault();
        o.onSetLayout("1up");
        return;
      }
      if (meta && e.shiftKey && e.key === "2") {
        e.preventDefault();
        o.onSetLayout("2up");
        return;
      }
      if (meta && e.shiftKey && e.key === "4") {
        e.preventDefault();
        o.onSetLayout("4up");
        return;
      }

      if (meta && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const s = o.sessions[parseInt(e.key, 10) - 1];
        if (s) o.onSelectSession(s.id);
        return;
      }

      if (meta && e.key === "[") {
        e.preventDefault();
        const idx = o.sessions.findIndex((s) => s.id === o.activeSessionId);
        if (idx > 0) o.onSelectSession(o.sessions[idx - 1].id);
        return;
      }

      if (meta && e.key === "]") {
        e.preventDefault();
        const idx = o.sessions.findIndex((s) => s.id === o.activeSessionId);
        if (idx < o.sessions.length - 1)
          o.onSelectSession(o.sessions[idx + 1].id);
        return;
      }

      if (meta && key === "w" && o.activeSessionId) {
        e.preventDefault();
        o.onKill(o.activeSessionId);
        return;
      }

      if (meta && key === "d" && o.activeSessionId) {
        e.preventDefault();
        o.onMarkDone(o.activeSessionId);
        return;
      }

      if (meta && key === "e" && o.activeSessionId) {
        e.preventDefault();
        o.onExport(o.activeSessionId);
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
