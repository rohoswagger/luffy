import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommandPalette } from "./CommandPalette";
import type { SessionData } from "../store/sessions";

const sessions: SessionData[] = [
  { id: "1", name: "feature-auth", tmux_session: "luffy-1", status: "THINKING", agent_type: "claude-code", branch: "feat/auth", worktree_path: null, created_at: "", last_activity: "" },
  { id: "2", name: "fix-bug-42", tmux_session: "luffy-2", status: "WAITING", agent_type: "aider", branch: "fix/42", worktree_path: null, created_at: "", last_activity: "" },
  { id: "3", name: "refactor-db", tmux_session: "luffy-3", status: "IDLE", agent_type: "generic", branch: null, worktree_path: null, created_at: "", last_activity: "" },
];

describe("CommandPalette", () => {
  it("renders when open", () => {
    render(<CommandPalette open sessions={sessions} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(/search sessions/i)).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    const { container } = render(<CommandPalette open={false} sessions={sessions} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows all sessions initially", () => {
    render(<CommandPalette open sessions={sessions} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("feature-auth")).toBeInTheDocument();
    expect(screen.getByText("fix-bug-42")).toBeInTheDocument();
    expect(screen.getByText("refactor-db")).toBeInTheDocument();
  });

  it("filters sessions by name on type", () => {
    render(<CommandPalette open sessions={sessions} onSelect={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search sessions/i), { target: { value: "auth" } });
    expect(screen.getByText("feature-auth")).toBeInTheDocument();
    expect(screen.queryByText("fix-bug-42")).toBeNull();
  });

  it("filters by branch name", () => {
    render(<CommandPalette open sessions={sessions} onSelect={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search sessions/i), { target: { value: "feat" } });
    expect(screen.getByText("feature-auth")).toBeInTheDocument();
  });

  it("calls onSelect with session id when item clicked", () => {
    const onSelect = vi.fn();
    render(<CommandPalette open sessions={sessions} onSelect={onSelect} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("fix-bug-42"));
    expect(onSelect).toHaveBeenCalledWith("2");
  });

  it("calls onClose when Escape pressed", () => {
    const onClose = vi.fn();
    render(<CommandPalette open sessions={sessions} onSelect={vi.fn()} onClose={onClose} />);
    fireEvent.keyDown(screen.getByPlaceholderText(/search sessions/i), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("selects first result on Enter", () => {
    const onSelect = vi.fn();
    render(<CommandPalette open sessions={sessions} onSelect={onSelect} onClose={vi.fn()} />);
    fireEvent.keyDown(screen.getByPlaceholderText(/search sessions/i), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("1");
  });
});
