import { create } from "zustand";

export interface SessionData {
  id: string;
  name: string;
  tmux_session: string;
  status: "THINKING" | "WAITING" | "IDLE" | "ERROR" | "DONE";
  agent_type: "claude-code" | "aider" | "generic";
  worktree_path: string | null;
  branch: string | null;
  created_at: string;
  last_activity: string;
  total_cost_usd: number;
}

interface SessionStore {
  sessions: SessionData[];
  activeSessionId: string | null;
  setSessions: (sessions: SessionData[]) => void;
  setActiveSession: (id: string | null) => void;
  updateSessionStatus: (id: string, status: SessionData["status"]) => void;
  addSession: (session: SessionData) => void;
  removeSession: (id: string) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  sessions: [],
  activeSessionId: null,
  setSessions: (sessions) => set({ sessions }),
  setActiveSession: (id) => set({ activeSessionId: id }),
  updateSessionStatus: (id, status) =>
    set((state) => ({
      sessions: state.sessions.map((s) => s.id === id ? { ...s, status } : s),
    })),
  addSession: (session) =>
    set((state) => ({ sessions: [...state.sessions, session] })),
  removeSession: (id) =>
    set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) })),
}));
