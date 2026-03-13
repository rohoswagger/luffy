import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BroadcastBar } from "./BroadcastBar";

describe("BroadcastBar", () => {
  it("renders input and broadcast button", () => {
    render(<BroadcastBar sessionCount={3} onBroadcast={vi.fn()} />);
    expect(screen.getByPlaceholderText(/broadcast/i)).toBeInTheDocument();
    expect(screen.getByTitle(/send to all/i)).toBeInTheDocument();
  });

  it("calls onBroadcast with input text on submit", () => {
    const onBroadcast = vi.fn();
    render(<BroadcastBar sessionCount={2} onBroadcast={onBroadcast} />);
    const input = screen.getByPlaceholderText(/broadcast/i);
    fireEvent.change(input, { target: { value: "run tests" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onBroadcast).toHaveBeenCalledWith("run tests");
  });

  it("clears input after broadcast", () => {
    render(<BroadcastBar sessionCount={2} onBroadcast={vi.fn()} />);
    const input = screen.getByPlaceholderText(/broadcast/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.value).toBe("");
  });

  it("shows session count badge", () => {
    render(<BroadcastBar sessionCount={4} onBroadcast={vi.fn()} />);
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("does not call onBroadcast when input is empty", () => {
    const onBroadcast = vi.fn();
    render(<BroadcastBar sessionCount={2} onBroadcast={onBroadcast} />);
    fireEvent.keyDown(screen.getByPlaceholderText(/broadcast/i), { key: "Enter" });
    expect(onBroadcast).not.toHaveBeenCalled();
  });
});
