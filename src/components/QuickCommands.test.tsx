import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickCommands } from "./QuickCommands";

describe("QuickCommands", () => {
  const defaults = ["y", "n", "continue", "exit"];

  it("renders preset command buttons", () => {
    render(<QuickCommands onSend={vi.fn()} />);
    for (const cmd of defaults) {
      expect(screen.getByRole("button", { name: cmd })).toBeInTheDocument();
    }
  });

  it("calls onSend with command + newline when clicked", () => {
    const onSend = vi.fn();
    render(<QuickCommands onSend={onSend} />);
    fireEvent.click(screen.getByRole("button", { name: "y" }));
    expect(onSend).toHaveBeenCalledWith("y\n");
  });

  it("calls onSend with correct command for each button", () => {
    const onSend = vi.fn();
    render(<QuickCommands onSend={onSend} />);
    fireEvent.click(screen.getByRole("button", { name: "continue" }));
    expect(onSend).toHaveBeenCalledWith("continue\n");
  });

  it("renders custom commands when provided", () => {
    render(<QuickCommands onSend={vi.fn()} commands={["hello", "world"]} />);
    expect(screen.getByRole("button", { name: "hello" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "world" })).toBeInTheDocument();
  });
});
