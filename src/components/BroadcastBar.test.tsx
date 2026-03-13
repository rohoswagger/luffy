import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BroadcastBar } from "./BroadcastBar";

describe("BroadcastBar", () => {
  it("renders input and broadcast button when expanded", () => {
    render(<BroadcastBar sessionCount={3} onBroadcast={vi.fn()} />);
    fireEvent.click(screen.getByText(/BROADCAST \(3\)/));
    expect(screen.getByPlaceholderText(/broadcast/i)).toBeInTheDocument();
    expect(screen.getByTitle(/send to all/i)).toBeInTheDocument();
  });

  it("calls onBroadcast with input text on submit", () => {
    const onBroadcast = vi.fn();
    render(<BroadcastBar sessionCount={2} onBroadcast={onBroadcast} />);
    fireEvent.click(screen.getByText(/BROADCAST \(2\)/));
    const input = screen.getByPlaceholderText(/broadcast/i);
    fireEvent.change(input, { target: { value: "run tests" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onBroadcast).toHaveBeenCalledWith("run tests");
  });

  it("clears input after broadcast", () => {
    render(<BroadcastBar sessionCount={2} onBroadcast={vi.fn()} />);
    fireEvent.click(screen.getByText(/BROADCAST \(2\)/));
    const input = screen.getByPlaceholderText(/broadcast/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.keyDown(input, { key: "Enter" });
    // Bar collapses after submit; expand again to verify input was cleared
    fireEvent.click(screen.getByText(/BROADCAST \(2\)/));
    const inputAfter = screen.getByPlaceholderText(
      /broadcast/i,
    ) as HTMLInputElement;
    expect(inputAfter.value).toBe("");
  });

  it("shows session count in collapsed bar and as badge when expanded", () => {
    render(<BroadcastBar sessionCount={4} onBroadcast={vi.fn()} />);
    expect(screen.getByText(/BROADCAST \(4\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/BROADCAST \(4\)/));
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("does not call onBroadcast when input is empty", () => {
    const onBroadcast = vi.fn();
    render(<BroadcastBar sessionCount={2} onBroadcast={onBroadcast} />);
    fireEvent.click(screen.getByText(/BROADCAST \(2\)/));
    fireEvent.keyDown(screen.getByPlaceholderText(/broadcast/i), {
      key: "Enter",
    });
    expect(onBroadcast).not.toHaveBeenCalled();
  });

  it("shows WAITING button and calls onBroadcastWaiting when waitingCount > 0", () => {
    const onBroadcastWaiting = vi.fn();
    render(
      <BroadcastBar
        sessionCount={3}
        waitingCount={2}
        onBroadcast={vi.fn()}
        onBroadcastWaiting={onBroadcastWaiting}
      />,
    );
    fireEvent.click(screen.getByText(/BROADCAST \(3\)/));
    const input = screen.getByPlaceholderText(/broadcast/i);
    fireEvent.change(input, { target: { value: "y" } });
    fireEvent.click(screen.getByTitle(/send to waiting/i));
    expect(onBroadcastWaiting).toHaveBeenCalledWith("y");
  });

  it("does not show WAITING button when waitingCount is 0 or not provided", () => {
    render(<BroadcastBar sessionCount={3} onBroadcast={vi.fn()} />);
    fireEvent.click(screen.getByText(/BROADCAST \(3\)/));
    expect(screen.queryByTitle(/send to waiting/i)).toBeNull();
  });

  it("starts collapsed by default", () => {
    render(<BroadcastBar sessionCount={3} onBroadcast={vi.fn()} />);
    // Collapsed bar shows session count in the toggle text
    expect(screen.getByText(/BROADCAST \(3\)/)).toBeInTheDocument();
    // Input should not be visible when collapsed
    expect(screen.queryByPlaceholderText(/broadcast/i)).toBeNull();
  });

  it("expands when the collapsed bar is clicked", () => {
    render(<BroadcastBar sessionCount={3} onBroadcast={vi.fn()} />);
    // Click the collapsed toggle
    fireEvent.click(screen.getByText(/BROADCAST \(3\)/));
    // Now the input should be visible
    expect(screen.getByPlaceholderText(/broadcast/i)).toBeInTheDocument();
    expect(screen.getByTitle(/send to all/i)).toBeInTheDocument();
  });

  it("collapses back after submitting a broadcast", () => {
    const onBroadcast = vi.fn();
    render(<BroadcastBar sessionCount={2} onBroadcast={onBroadcast} />);
    // Expand first
    fireEvent.click(screen.getByText(/BROADCAST \(2\)/));
    const input = screen.getByPlaceholderText(/broadcast/i);
    fireEvent.change(input, { target: { value: "run tests" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onBroadcast).toHaveBeenCalledWith("run tests");
    // Should be collapsed again
    expect(screen.queryByPlaceholderText(/broadcast/i)).toBeNull();
    expect(screen.getByText(/BROADCAST \(2\)/)).toBeInTheDocument();
  });

  it("collapses when Escape is pressed in the input", () => {
    render(<BroadcastBar sessionCount={3} onBroadcast={vi.fn()} />);
    // Expand
    fireEvent.click(screen.getByText(/BROADCAST \(3\)/));
    expect(screen.getByPlaceholderText(/broadcast/i)).toBeInTheDocument();
    // Press Escape
    fireEvent.keyDown(screen.getByPlaceholderText(/broadcast/i), {
      key: "Escape",
    });
    // Should be collapsed
    expect(screen.queryByPlaceholderText(/broadcast/i)).toBeNull();
  });
});
