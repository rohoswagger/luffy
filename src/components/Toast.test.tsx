import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Toast } from "./Toast";

describe("Toast", () => {
  it("renders the message", () => {
    render(<Toast message="Saved: /Downloads/log.txt" onDismiss={vi.fn()} />);
    expect(screen.getByText("Saved: /Downloads/log.txt")).toBeInTheDocument();
  });

  it("calls onDismiss when clicked", () => {
    const onDismiss = vi.fn();
    render(<Toast message="hello" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText("hello"));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("calls onDismiss after durationMs", async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <Toast message="auto-dismiss" onDismiss={onDismiss} durationMs={1000} />,
    );
    expect(onDismiss).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1001);
    });
    expect(onDismiss).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("clears timeout on unmount", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { unmount } = render(
      <Toast message="x" onDismiss={onDismiss} durationMs={1000} />,
    );
    unmount();
    vi.advanceTimersByTime(1001);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("has role=alert and aria-live=polite for accessibility", () => {
    render(<Toast message="test a11y" onDismiss={vi.fn()} />);
    const el = screen.getByRole("alert");
    expect(el).toHaveAttribute("aria-live", "polite");
    expect(el).toHaveTextContent("test a11y");
  });
});
