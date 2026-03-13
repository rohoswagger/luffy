import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KeyboardHelp } from "./KeyboardHelp";

describe("KeyboardHelp", () => {
  it("renders when open", () => {
    render(<KeyboardHelp open onClose={vi.fn()} />);
    expect(screen.getByText(/keyboard shortcuts/i)).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    const { container } = render(
      <KeyboardHelp open={false} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows core shortcuts", () => {
    render(<KeyboardHelp open onClose={vi.fn()} />);
    expect(screen.getByText(/Cmd\+K/i)).toBeInTheDocument();
    expect(screen.getByText(/Cmd\+N/i)).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<KeyboardHelp open onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes when clicking backdrop", () => {
    const onClose = vi.fn();
    const { container } = render(<KeyboardHelp open onClose={onClose} />);
    fireEvent.click(container.firstChild!);
    expect(onClose).toHaveBeenCalled();
  });
});
