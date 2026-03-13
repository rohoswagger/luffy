import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SessionSidebar } from "./SessionSidebar";
import type { SessionData } from "../store/sessions";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));

const mockSessions: SessionData[] = [
  { id: "1", name: "feature-auth", tmux_session: "luffy-abc", status: "THINKING", agent_type: "claude-code", worktree_path: "/repo", branch: "feat/auth", created_at: "", last_activity: "", total_cost_usd: 0.123, note: null },
  { id: "2", name: "fix-bug-42", tmux_session: "luffy-def", status: "WAITING", agent_type: "aider", worktree_path: null, branch: "fix/bug-42", created_at: "", last_activity: "", total_cost_usd: 0, note: "fixing the login regression" },
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

  it("shows cost when total_cost_usd > 0", () => {
    render(<SessionSidebar sessions={mockSessions} activeId={null} onSelect={vi.fn()} onNewSession={vi.fn()} onKill={vi.fn()} />);
    // Both per-session cost and footer total show the amount
    expect(screen.getAllByText(/\$0\.12/).length).toBeGreaterThan(0);
  });

  it("does not show cost when total_cost_usd is 0", () => {
    render(<SessionSidebar sessions={mockSessions} activeId={null} onSelect={vi.fn()} onNewSession={vi.fn()} onKill={vi.fn()} />);
    // Only session 1 has cost; session 2 has 0 — should not show $0.00
    expect(screen.queryByText(/\$0\.00/)).toBeNull();
  });

  it("shows total cost in footer when any session has cost", () => {
    render(<SessionSidebar sessions={mockSessions} activeId={null} onSelect={vi.fn()} onNewSession={vi.fn()} onKill={vi.fn()} />);
    expect(screen.getByText(/total \$/)).toBeInTheDocument();
  });

  it("does not show total cost in footer when all costs are 0", () => {
    const zeroCostSessions = mockSessions.map((s) => ({ ...s, total_cost_usd: 0 }));
    render(<SessionSidebar sessions={zeroCostSessions} activeId={null} onSelect={vi.fn()} onNewSession={vi.fn()} onKill={vi.fn()} />);
    expect(screen.queryByText(/total \$/)).toBeNull();
  });

  it("calls onFork when fork button clicked", () => {
    const onFork = vi.fn();
    render(<SessionSidebar sessions={mockSessions} activeId={null} onSelect={vi.fn()} onNewSession={vi.fn()} onKill={vi.fn()} onFork={onFork} />);
    // Sessions are sorted: WAITING (id "2") first, THINKING (id "1") second
    const forkBtns = screen.getAllByTitle("Fork session");
    fireEvent.click(forkBtns[0]);
    expect(onFork).toHaveBeenCalledWith("2"); // "fix-bug-42" is WAITING, sorts first
  });

  it("filters sessions by search query", () => {
    render(<SessionSidebar sessions={mockSessions} activeId={null} onSelect={vi.fn()} onNewSession={vi.fn()} onKill={vi.fn()} />);
    const searchInput = screen.getByPlaceholderText(/filter/i);
    fireEvent.change(searchInput, { target: { value: "auth" } });
    expect(screen.getByText("feature-auth")).toBeInTheDocument();
    expect(screen.queryByText("fix-bug-42")).toBeNull();
  });

  it("shows all sessions when filter is cleared", () => {
    render(<SessionSidebar sessions={mockSessions} activeId={null} onSelect={vi.fn()} onNewSession={vi.fn()} onKill={vi.fn()} />);
    const searchInput = screen.getByPlaceholderText(/filter/i);
    fireEvent.change(searchInput, { target: { value: "auth" } });
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(screen.getByText("feature-auth")).toBeInTheDocument();
    expect(screen.getByText("fix-bug-42")).toBeInTheDocument();
  });

  it("renders without onFork prop (optional)", () => {
    // Should not crash when onFork is not provided
    expect(() =>
      render(<SessionSidebar sessions={mockSessions} activeId={null} onSelect={vi.fn()} onNewSession={vi.fn()} onKill={vi.fn()} />)
    ).not.toThrow();
  });

  it("shows rename input on double-click of session name", () => {
    render(<SessionSidebar sessions={mockSessions} activeId={null} onSelect={vi.fn()} onNewSession={vi.fn()} onKill={vi.fn()} />);
    fireEvent.doubleClick(screen.getByText("feature-auth"));
    expect(screen.getByDisplayValue("feature-auth")).toBeInTheDocument();
  });

  it("hides rename input on Escape", () => {
    render(<SessionSidebar sessions={mockSessions} activeId={null} onSelect={vi.fn()} onNewSession={vi.fn()} onKill={vi.fn()} />);
    fireEvent.doubleClick(screen.getByText("feature-auth"));
    const input = screen.getByDisplayValue("feature-auth");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByDisplayValue("feature-auth")).toBeNull();
  });

  it("shows session note when note is set", () => {
    render(<SessionSidebar sessions={mockSessions} activeId={null} onSelect={vi.fn()} onNewSession={vi.fn()} onKill={vi.fn()} />);
    expect(screen.getByText("fixing the login regression")).toBeInTheDocument();
  });

  it("does not show note area when note is null", () => {
    const noNote = [{ ...mockSessions[0], note: null }];
    render(<SessionSidebar sessions={noNote} activeId={null} onSelect={vi.fn()} onNewSession={vi.fn()} onKill={vi.fn()} />);
    expect(screen.queryByTitle(/edit note/i)).toBeNull();
  });
});
