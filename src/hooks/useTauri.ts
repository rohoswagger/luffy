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
        invoke<SessionData[]>("list_sessions").then(setSessions).catch(() => {});
      });

    const unlisten = listen<SessionData[]>("sessions-updated", (event) => {
      setSessions(event.payload);
    });

    const unlistenNeeds = listen<string>("agent-needs-input", (event) => {
      if (Notification.permission === "granted") {
        new Notification("Agent needs your input", {
          body: `${event.payload} is waiting`,
          silent: false,
        });
      }
    });

    return () => {
      unlisten.then((fn) => fn());
      unlistenNeeds.then((fn) => fn());
    };
  }, [setSessions]);
}

export async function createSession(args: { name: string; agent_type: string; working_dir: string | null }) {
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
