import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PaneGrid } from "./PaneGrid";
import type { SessionData } from "../store/sessions";

vi.mock("@xterm/xterm", () => {
  class Terminal {
    open = vi.fn(); write = vi.fn(); onData = vi.fn();
    dispose = vi.fn(); loadAddon = vi.fn(); options = {};
  }
  return { Terminal };
});
vi.mock("@xterm/addon-fit", () => {
  class FitAddon { fit = vi.fn(); activate = vi.fn(); proposeDimensions = vi.fn().mockReturnValue({ rows: 24, cols: 80 }); }
  return { FitAddon };
});
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));

const makeSession = (id: string, name: string): SessionData => ({
  id, name, tmux_session: `luffy-${id}`, status: "IDLE",
  agent_type: "claude-code", worktree_path: null, branch: null,
  created_at: "", last_activity: "",
});

describe("PaneGrid", () => {
  it("renders 1-up layout with one session", () => {
    const sessions = [makeSession("1", "a")];
    const { container } = render(
      <PaneGrid sessions={sessions} activeId="1" onActivate={vi.fn()} layout="1up" />
    );
    expect(container.querySelectorAll(".pane-slot")).toHaveLength(1);
  });

  it("renders 2-up layout with two pane slots", () => {
    const sessions = [makeSession("1", "a"), makeSession("2", "b")];
    const { container } = render(
      <PaneGrid sessions={sessions} activeId="1" onActivate={vi.fn()} layout="2up" />
    );
    expect(container.querySelectorAll(".pane-slot")).toHaveLength(2);
  });

  it("renders 4-up layout with four pane slots", () => {
    const sessions = [makeSession("1", "a"), makeSession("2", "b")];
    const { container } = render(
      <PaneGrid sessions={sessions} activeId="1" onActivate={vi.fn()} layout="4up" />
    );
    expect(container.querySelectorAll(".pane-slot")).toHaveLength(4);
  });

  it("calls onActivate when clicking a pane header", () => {
    const sessions = [makeSession("1", "a"), makeSession("2", "b")];
    const onActivate = vi.fn();
    render(<PaneGrid sessions={sessions} activeId="1" onActivate={onActivate} layout="2up" />);
    fireEvent.click(screen.getByText("b"));
    expect(onActivate).toHaveBeenCalledWith("2");
  });

  it("shows empty slot when no session assigned to slot", () => {
    const sessions = [makeSession("1", "a")];
    const { container } = render(
      <PaneGrid sessions={sessions} activeId="1" onActivate={vi.fn()} layout="2up" />
    );
    expect(container.querySelector(".pane-empty")).toBeTruthy();
  });
});
