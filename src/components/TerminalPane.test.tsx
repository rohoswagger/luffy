import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TerminalPane } from "./TerminalPane";
import { invoke } from "@tauri-apps/api/core";

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
    proposeDimensions = vi.fn().mockReturnValue({ rows: 24, cols: 80 });
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
      <TerminalPane sessionId="test-id" tmuxSession="luffy-abc" active />,
    );
    expect(container.querySelector(".terminal-container")).toBeTruthy();
  });

  it("renders empty state with keyboard shortcut when no sessionId", () => {
    render(<TerminalPane sessionId={null} tmuxSession={null} active />);
    expect(screen.getByText(/⌘N/)).toBeInTheDocument();
  });

  it("calls resize_pty after initial fit", async () => {
    render(<TerminalPane sessionId="test-id" tmuxSession="luffy-abc" active />);
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "resize_pty",
        expect.objectContaining({ sessionId: "test-id" }),
      );
    });
  });

  it("fetches stored output on mount via get_pty_output", async () => {
    render(<TerminalPane sessionId="s1" tmuxSession="luffy-s1" active />);
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("get_pty_output", {
        sessionId: "s1",
      });
    });
  });
});
