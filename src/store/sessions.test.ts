import { describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { useSessionStore } from "./sessions";

beforeEach(() => {
  useSessionStore.setState({ sessions: [], activeSessionId: null });
});

const mockSession = {
  id: "1",
  name: "test",
  status: "IDLE" as const,
  agent_type: "claude-code" as const,
  tmux_session: "luffy-abc",
  created_at: "",
  last_activity: "",
  worktree_path: null,
  branch: null,
  total_cost_usd: 0,
  cost_budget_usd: 0,
  note: null,
  last_output_preview: "",
  startup_command: null,
};

describe("session store", () => {
  it("starts empty", () => {
    expect(useSessionStore.getState().sessions).toHaveLength(0);
  });

  it("setSessions replaces all sessions", () => {
    act(() => useSessionStore.getState().setSessions([mockSession]));
    expect(useSessionStore.getState().sessions).toHaveLength(1);
  });

  it("setActiveSession updates activeSessionId", () => {
    act(() => useSessionStore.getState().setActiveSession("abc"));
    expect(useSessionStore.getState().activeSessionId).toBe("abc");
  });

  it("updateSessionStatus mutates only matching session", () => {
    const s2 = {
      ...mockSession,
      id: "2",
      name: "b",
      tmux_session: "luffy-def",
    };
    act(() => useSessionStore.getState().setSessions([mockSession, s2]));
    act(() => useSessionStore.getState().updateSessionStatus("1", "THINKING"));
    const sessions = useSessionStore.getState().sessions;
    expect(sessions.find((x) => x.id === "1")?.status).toBe("THINKING");
    expect(sessions.find((x) => x.id === "2")?.status).toBe("IDLE");
  });
});
