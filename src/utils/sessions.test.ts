import { describe, it, expect } from "vitest";
import { nextWaitingSessionId, sortSessionsByPriority } from "./sessions";
import type { SessionData } from "../store/sessions";

const makeSession = (id: string, status: SessionData["status"]): SessionData => ({
  id, name: id, tmux_session: "", status, agent_type: "generic",
  worktree_path: null, branch: null, created_at: "", last_activity: "", total_cost_usd: 0,
});

describe("sortSessionsByPriority", () => {
  it("puts WAITING before THINKING before IDLE before ERROR before DONE", () => {
    const sessions = [
      makeSession("done", "DONE"),
      makeSession("error", "ERROR"),
      makeSession("idle", "IDLE"),
      makeSession("thinking", "THINKING"),
      makeSession("waiting", "WAITING"),
    ];
    const sorted = sortSessionsByPriority(sessions);
    expect(sorted[0].id).toBe("waiting");
    expect(sorted[1].id).toBe("thinking");
    expect(sorted[2].id).toBe("idle");
    expect(sorted[3].id).toBe("error");
    expect(sorted[4].id).toBe("done");
  });

  it("preserves relative order within same status", () => {
    const sessions = [
      makeSession("w1", "WAITING"),
      makeSession("w2", "WAITING"),
    ];
    const sorted = sortSessionsByPriority(sessions);
    expect(sorted[0].id).toBe("w1");
    expect(sorted[1].id).toBe("w2");
  });
});

describe("nextWaitingSessionId", () => {
  it("returns null when no WAITING sessions", () => {
    const sessions = [makeSession("a", "THINKING"), makeSession("b", "DONE")];
    expect(nextWaitingSessionId(sessions, null)).toBeNull();
  });

  it("returns first WAITING session when currentId is null", () => {
    const sessions = [makeSession("a", "IDLE"), makeSession("b", "WAITING"), makeSession("c", "WAITING")];
    expect(nextWaitingSessionId(sessions, null)).toBe("b");
  });

  it("returns next WAITING session when current is WAITING", () => {
    const sessions = [makeSession("a", "WAITING"), makeSession("b", "IDLE"), makeSession("c", "WAITING")];
    expect(nextWaitingSessionId(sessions, "a")).toBe("c");
  });

  it("wraps around to first WAITING session", () => {
    const sessions = [makeSession("a", "WAITING"), makeSession("b", "WAITING")];
    expect(nextWaitingSessionId(sessions, "b")).toBe("a");
  });

  it("returns first WAITING when currentId is not in WAITING list", () => {
    const sessions = [makeSession("a", "THINKING"), makeSession("b", "WAITING")];
    expect(nextWaitingSessionId(sessions, "a")).toBe("b");
  });
});
