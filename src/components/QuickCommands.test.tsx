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

  it("renders ^C button always", () => {
    render(<QuickCommands onSend={vi.fn()} />);
    expect(screen.getByRole("button", { name: /\^C/i })).toBeInTheDocument();
  });

  it("sends Ctrl+C raw byte when ^C clicked", () => {
    const onSend = vi.fn();
    render(<QuickCommands onSend={onSend} />);
    fireEvent.click(screen.getByRole("button", { name: /\^C/i }));
    expect(onSend).toHaveBeenCalledWith("\x03");
  });

  it("renders a custom input field", () => {
    render(<QuickCommands onSend={vi.fn()} />);
    expect(screen.getByPlaceholderText(/custom/i)).toBeInTheDocument();
  });

  it("sends custom input + newline on Enter and clears the field", () => {
    const onSend = vi.fn();
    render(<QuickCommands onSend={onSend} />);
    const input = screen.getByPlaceholderText(/custom/i);
    fireEvent.change(input, { target: { value: "my reply" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("my reply\n");
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("does not send empty input on Enter", () => {
    const onSend = vi.fn();
    render(<QuickCommands onSend={onSend} />);
    const input = screen.getByPlaceholderText(/custom/i);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });
});
