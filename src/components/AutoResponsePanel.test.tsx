import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AutoResponsePanel } from "./AutoResponsePanel";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const mockPatterns = [
  { id: "p1", pattern: "[y/n]", response: "y", enabled: true },
  { id: "p2", pattern: "press enter", response: "", enabled: false },
];

describe("AutoResponsePanel", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("does not render when closed", () => {
    const { container } = render(
      <AutoResponsePanel open={false} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("loads and displays patterns", async () => {
    mockInvoke.mockResolvedValue(mockPatterns);
    render(<AutoResponsePanel open onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("[y/n]")).toBeInTheDocument());
    expect(screen.getByText("press enter")).toBeInTheDocument();
  });

  it("shows enabled/disabled state", async () => {
    mockInvoke.mockResolvedValue(mockPatterns);
    render(<AutoResponsePanel open onClose={vi.fn()} />);
    await waitFor(() => screen.getByText("[y/n]"));
    const toggles = screen.getAllByRole("checkbox");
    expect((toggles[0] as HTMLInputElement).checked).toBe(true);
    expect((toggles[1] as HTMLInputElement).checked).toBe(false);
  });

  it("calls delete_auto_response when delete clicked", async () => {
    mockInvoke
      .mockResolvedValueOnce(mockPatterns)
      .mockResolvedValueOnce([mockPatterns[1]]);
    render(<AutoResponsePanel open onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByRole("button", { name: /delete/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /delete/i })[0]);
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("delete_auto_response", {
        id: "p1",
      }),
    );
  });

  it("calls add_auto_response when form submitted", async () => {
    mockInvoke
      .mockResolvedValueOnce(mockPatterns)
      .mockResolvedValueOnce([
        ...mockPatterns,
        { id: "p3", pattern: "are you sure", response: "yes", enabled: true },
      ]);
    render(<AutoResponsePanel open onClose={vi.fn()} />);
    await waitFor(() => screen.getByPlaceholderText(/pattern/i));
    fireEvent.change(screen.getByPlaceholderText(/pattern/i), {
      target: { value: "are you sure" },
    });
    fireEvent.change(screen.getByPlaceholderText(/response/i), {
      target: { value: "yes" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("add_auto_response", {
        pattern: "are you sure",
        response: "yes",
      }),
    );
  });

  it("disables Add button when pattern is empty", async () => {
    mockInvoke.mockResolvedValue([]);
    render(<AutoResponsePanel open onClose={vi.fn()} />);
    await waitFor(() => screen.getByPlaceholderText(/pattern/i));
    const addBtn = screen.getByRole("button", { name: /add/i });
    expect(addBtn).toBeDisabled();
  });

  it("enables Add button when pattern has text", async () => {
    mockInvoke.mockResolvedValue([]);
    render(<AutoResponsePanel open onClose={vi.fn()} />);
    await waitFor(() => screen.getByPlaceholderText(/pattern/i));
    fireEvent.change(screen.getByPlaceholderText(/pattern/i), {
      target: { value: "test" },
    });
    expect(screen.getByRole("button", { name: /add/i })).not.toBeDisabled();
  });

  it("calls toggle_auto_response when checkbox changed", async () => {
    mockInvoke
      .mockResolvedValueOnce(mockPatterns)
      .mockResolvedValueOnce(mockPatterns);
    render(<AutoResponsePanel open onClose={vi.fn()} />);
    await waitFor(() => screen.getByText("[y/n]"));
    const toggles = screen.getAllByRole("checkbox");
    fireEvent.click(toggles[0]);
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("toggle_auto_response", {
        id: "p1",
        enabled: false,
      }),
    );
  });
});
