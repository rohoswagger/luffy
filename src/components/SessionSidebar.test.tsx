import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SessionSidebar } from "./SessionSidebar";
import type { SessionData } from "../store/sessions";

const mockSessions: SessionData[] = [
  { id: "1", name: "feature-auth", tmux_session: "luffy-abc", status: "THINKING", agent_type: "claude-code", worktree_path: "/repo", branch: "feat/auth", created_at: "", last_activity: "" },
  { id: "2", name: "fix-bug-42", tmux_session: "luffy-def", status: "WAITING", agent_type: "aider", worktree_path: null, branch: "fix/bug-42", created_at: "", last_activity: "" },
];

describe("SessionSidebar", () => {
  it("renders session names", () => {
    render(<SessionSidebar sessions={mockSessions} activeId={null} onSelect={vi.fn()} onNewSession={vi.fn()} onKill={vi.fn()} />);
    expect(screen.getByText("feature-auth")).toBeInTheDocument();
    expect(screen.getByText("fix-bug-42")).toBeInTheDocument();
  });

  it("calls onSelect when clicking a session", () => {
    const onSelect = vi.fn();
    render(<SessionSidebar sessions={mockSessions} activeId={null} onSelect={onSelect} onNewSession={vi.fn()} onKill={vi.fn()} />);
    fireEvent.click(screen.getByText("feature-auth"));
    expect(onSelect).toHaveBeenCalledWith("1");
  });

  it("highlights active session", () => {
    const { container } = render(<SessionSidebar sessions={mockSessions} activeId="1" onSelect={vi.fn()} onNewSession={vi.fn()} onKill={vi.fn()} />);
    expect(container.querySelector("[data-active='true']")).toBeTruthy();
  });

  it("calls onNewSession when + button clicked", () => {
    const onNewSession = vi.fn();
    render(<SessionSidebar sessions={[]} activeId={null} onSelect={vi.fn()} onNewSession={onNewSession} onKill={vi.fn()} />);
    fireEvent.click(screen.getByTitle("New session"));
    expect(onNewSession).toHaveBeenCalled();
  });

  it("shows branch name when available", () => {
    render(<SessionSidebar sessions={mockSessions} activeId={null} onSelect={vi.fn()} onNewSession={vi.fn()} onKill={vi.fn()} />);
    expect(screen.getByText("feat/auth")).toBeInTheDocument();
  });
});
