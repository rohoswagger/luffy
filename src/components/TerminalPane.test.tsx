import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TerminalPane } from "./TerminalPane";

vi.mock("@xterm/xterm", () => {
  class Terminal {
    open = vi.fn();
    write = vi.fn();
    onData = vi.fn();
    dispose = vi.fn();
    loadAddon = vi.fn();
    options = {};
  }
  return { Terminal };
});

vi.mock("@xterm/addon-fit", () => {
  class FitAddon {
    fit = vi.fn();
    activate = vi.fn();
  }
  return { FitAddon };
});

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

describe("TerminalPane", () => {
  it("renders the terminal container div", () => {
    const { container } = render(
      <TerminalPane sessionId="test-id" tmuxSession="luffy-abc" active />
    );
    expect(container.querySelector(".terminal-container")).toBeTruthy();
  });

  it("renders empty state when no sessionId", () => {
    render(<TerminalPane sessionId={null} tmuxSession={null} active />);
    expect(screen.getByText(/select a session/i)).toBeInTheDocument();
  });
});
