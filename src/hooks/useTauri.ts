import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useSessionStore, type SessionData } from "../store/sessions";

export function useTauriEvents() {
  const { setSessions } = useSessionStore();

  useEffect(() => {
    invoke<SessionData[]>("restore_sessions")
      .then(setSessions)
      .catch(() => {
        invoke<SessionData[]>("list_sessions").then(setSessions).catch(() => {});
      });

    const unlisten = listen<SessionData[]>("sessions-updated", (event) => {
      setSessions(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
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
