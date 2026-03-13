import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import type { SessionData } from "../store/sessions";

function makeSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    id: "s1",
    name: "test-session",
    tmux_session: "tmux-s1",
    status: "THINKING",
    agent_type: "claude-code",
    worktree_path: null,
    branch: null,
    created_at: "2025-01-01T00:00:00Z",
    last_activity: "2025-01-01T00:00:00Z",
    total_cost_usd: 0,
    cost_budget_usd: 0,
    note: null,
    last_output_preview: "",
    startup_command: null,
    ...overrides,
  };
}

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  window.dispatchEvent(event);
}

describe("useKeyboardShortcuts", () => {
  const defaults = () => ({
    sessions: [
      makeSession({ id: "s1", name: "first" }),
      makeSession({ id: "s2", name: "second" }),
      makeSession({ id: "s3", name: "third" }),
    ],
    activeSessionId: "s1" as string | null,
    onNewSession: vi.fn(),
    onTemplates: vi.fn(),
    onAutoRespond: vi.fn(),
    onPalette: vi.fn(),
    onSearch: vi.fn(),
    onToggleEventLog: vi.fn(),
    onToggleHelp: vi.fn(),
    onJumpNextWaiting: vi.fn(),
    onSelectSession: vi.fn(),
    onKill: vi.fn(),
    onSetLayout: vi.fn(),
  });

  it("Cmd+N calls onNewSession", () => {
    const opts = defaults();
    renderHook(() => useKeyboardShortcuts(opts));
    fireKey("n", { metaKey: true });
    expect(opts.onNewSession).toHaveBeenCalledOnce();
  });

  it("Cmd+K calls onPalette", () => {
    const opts = defaults();
    renderHook(() => useKeyboardShortcuts(opts));
    fireKey("k", { metaKey: true });
    expect(opts.onPalette).toHaveBeenCalledOnce();
  });

  it("Cmd+W calls onKill with activeSessionId", () => {
    const opts = defaults();
    opts.activeSessionId = "s2";
    renderHook(() => useKeyboardShortcuts(opts));
    fireKey("w", { metaKey: true });
    expect(opts.onKill).toHaveBeenCalledWith("s2");
  });

  it("Cmd+W does nothing when no active session", () => {
    const opts = defaults();
    opts.activeSessionId = null;
    renderHook(() => useKeyboardShortcuts(opts));
    fireKey("w", { metaKey: true });
    expect(opts.onKill).not.toHaveBeenCalled();
  });

  it("Cmd+1 calls onSelectSession with the first session id", () => {
    const opts = defaults();
    renderHook(() => useKeyboardShortcuts(opts));
    fireKey("1", { metaKey: true });
    expect(opts.onSelectSession).toHaveBeenCalledWith("s1");
  });

  it("Cmd+3 calls onSelectSession with the third session id", () => {
    const opts = defaults();
    renderHook(() => useKeyboardShortcuts(opts));
    fireKey("3", { metaKey: true });
    expect(opts.onSelectSession).toHaveBeenCalledWith("s3");
  });

  it("Cmd+9 does nothing when only 3 sessions exist", () => {
    const opts = defaults();
    renderHook(() => useKeyboardShortcuts(opts));
    fireKey("9", { metaKey: true });
    expect(opts.onSelectSession).not.toHaveBeenCalled();
  });

  it("Cmd+[ cycles to previous session", () => {
    const opts = defaults();
    opts.activeSessionId = "s2";
    renderHook(() => useKeyboardShortcuts(opts));
    fireKey("[", { metaKey: true });
    expect(opts.onSelectSession).toHaveBeenCalledWith("s1");
  });

  it("Cmd+[ does nothing when on first session", () => {
    const opts = defaults();
    opts.activeSessionId = "s1";
    renderHook(() => useKeyboardShortcuts(opts));
    fireKey("[", { metaKey: true });
    expect(opts.onSelectSession).not.toHaveBeenCalled();
  });

  it("Cmd+] cycles to next session", () => {
    const opts = defaults();
    opts.activeSessionId = "s1";
    renderHook(() => useKeyboardShortcuts(opts));
    fireKey("]", { metaKey: true });
    expect(opts.onSelectSession).toHaveBeenCalledWith("s2");
  });

  it("Cmd+T calls onTemplates", () => {
    const opts = defaults();
    renderHook(() => useKeyboardShortcuts(opts));
    fireKey("t", { metaKey: true });
    expect(opts.onTemplates).toHaveBeenCalledOnce();
  });

  it("Cmd+Shift+R calls onAutoRespond", () => {
    const opts = defaults();
    renderHook(() => useKeyboardShortcuts(opts));
    fireKey("r", { metaKey: true, shiftKey: true });
    expect(opts.onAutoRespond).toHaveBeenCalledOnce();
  });

  it("Cmd+Shift+F calls onSearch", () => {
    const opts = defaults();
    renderHook(() => useKeyboardShortcuts(opts));
    fireKey("f", { metaKey: true, shiftKey: true });
    expect(opts.onSearch).toHaveBeenCalledOnce();
  });

  it("Cmd+L calls onToggleEventLog", () => {
    const opts = defaults();
    renderHook(() => useKeyboardShortcuts(opts));
    fireKey("l", { metaKey: true });
    expect(opts.onToggleEventLog).toHaveBeenCalledOnce();
  });

  it("Cmd+/ calls onToggleHelp", () => {
    const opts = defaults();
    renderHook(() => useKeyboardShortcuts(opts));
    fireKey("/", { metaKey: true });
    expect(opts.onToggleHelp).toHaveBeenCalledOnce();
  });

  it("Cmd+Shift+A calls onJumpNextWaiting", () => {
    const opts = defaults();
    renderHook(() => useKeyboardShortcuts(opts));
    fireKey("a", { metaKey: true, shiftKey: true });
    expect(opts.onJumpNextWaiting).toHaveBeenCalledOnce();
  });

  it("Cmd+Shift+1 calls onSetLayout with '1up'", () => {
    const opts = defaults();
    renderHook(() => useKeyboardShortcuts(opts));
    fireKey("1", { metaKey: true, shiftKey: true });
    expect(opts.onSetLayout).toHaveBeenCalledWith("1up");
  });

  it("Cmd+Shift+2 calls onSetLayout with '2up'", () => {
    const opts = defaults();
    renderHook(() => useKeyboardShortcuts(opts));
    fireKey("2", { metaKey: true, shiftKey: true });
    expect(opts.onSetLayout).toHaveBeenCalledWith("2up");
  });

  it("Cmd+Shift+4 calls onSetLayout with '4up'", () => {
    const opts = defaults();
    renderHook(() => useKeyboardShortcuts(opts));
    fireKey("4", { metaKey: true, shiftKey: true });
    expect(opts.onSetLayout).toHaveBeenCalledWith("4up");
  });

  it("cleans up listener on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const opts = defaults();
    const { unmount } = renderHook(() => useKeyboardShortcuts(opts));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    removeSpy.mockRestore();
  });
});
