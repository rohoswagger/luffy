import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useSessionStore, type SessionData } from "../store/sessions";

export function useTauriEvents() {
  const { setSessions } = useSessionStore();

  useEffect(() => {
    // Request desktop notification permission on app start
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    invoke<SessionData[]>("restore_sessions")
      .then(setSessions)
      .catch(() => {
        invoke<SessionData[]>("list_sessions")
          .then(setSessions)
          .catch(() => {});
      });

    const unlisten = listen<SessionData[]>("sessions-updated", (event) => {
      setSessions(event.payload);
    });

    const unlistenNeeds = listen<string>("agent-needs-input", (event) => {
      const sessions = useSessionStore.getState().sessions;
      const session = sessions.find((s) => s.id === event.payload);
      const name = session?.name ?? event.payload;
      if (Notification.permission === "granted") {
        new Notification("Agent needs your input", {
          body: `${name} is waiting`,
          silent: false,
        });
      }
    });

    const unlistenBudget = listen<string>("cost-budget-exceeded", (event) => {
      const sessions = useSessionStore.getState().sessions;
      const session = sessions.find((s) => s.id === event.payload);
      const name = session?.name ?? event.payload;
      if (Notification.permission === "granted") {
        new Notification("Cost budget exceeded", {
          body: `${name} has exceeded its cost budget`,
          silent: false,
        });
      }
    });

    const unlistenStuck = listen<string>("session-stuck", (event) => {
      const sessions = useSessionStore.getState().sessions;
      const session = sessions.find((s) => s.id === event.payload);
      const name = session?.name ?? event.payload;
      if (Notification.permission === "granted") {
        new Notification("Session auto-interrupted", {
          body: `${name} appeared stuck (no output for 15 min) — sent Ctrl+C`,
          silent: false,
        });
      }
    });

    const unlistenBatch = listen<string>("batch-done", (event) => {
      if (Notification.permission === "granted") {
        new Notification("All agents finished", {
          body: event.payload,
          silent: false,
        });
      }
    });

    return () => {
      unlisten.then((fn) => fn()).catch(() => {});
      unlistenNeeds.then((fn) => fn()).catch(() => {});
      unlistenBudget.then((fn) => fn()).catch(() => {});
      unlistenStuck.then((fn) => fn()).catch(() => {});
      unlistenBatch.then((fn) => fn()).catch(() => {});
    };
  }, [setSessions]);
}

export async function createSession(args: {
  name: string;
  agent_type: string;
  working_dir: string | null;
  startup_command?: string;
  create_worktree?: boolean;
  cost_budget_usd?: number;
}) {
  return invoke<SessionData>("create_session", { args });
}

export async function killSession(sessionId: string) {
  return invoke<void>("kill_session", { sessionId });
}

export async function broadcastInput(input: string) {
  return invoke<string[]>("broadcast_input", { input });
}

export async function forkSession(sessionId: string) {
  return invoke<SessionData>("fork_session", { sessionId });
}

export async function setSessionNote(sessionId: string, note: string) {
  return invoke<void>("set_session_note", { sessionId, note });
}
