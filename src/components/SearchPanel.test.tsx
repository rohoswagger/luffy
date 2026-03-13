import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SearchPanel } from "./SearchPanel";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const mockResults = [
  {
    session_id: "1",
    session_name: "auth-agent",
    line_number: 42,
    excerpt: "error: connection refused",
  },
  {
    session_id: "1",
    session_name: "auth-agent",
    line_number: 55,
    excerpt: "error: timeout on retry",
  },
  {
    session_id: "2",
    session_name: "db-agent",
    line_number: 7,
    excerpt: "database error: null pointer",
  },
];

describe("SearchPanel", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("renders when open", () => {
    render(<SearchPanel open onClose={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByPlaceholderText(/search output/i)).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    const { container } = render(
      <SearchPanel open={false} onClose={vi.fn()} onNavigate={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("calls search_output invoke on input change", async () => {
    mockInvoke.mockResolvedValue([]);
    render(<SearchPanel open onClose={vi.fn()} onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search output/i), {
      target: { value: "error" },
    });
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("search_output", {
        query: "error",
      }),
    );
  });

  it("shows results grouped by session name", async () => {
    mockInvoke.mockResolvedValue(mockResults);
    render(<SearchPanel open onClose={vi.fn()} onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search output/i), {
      target: { value: "error" },
    });
    await waitFor(() =>
      expect(screen.getByText("auth-agent")).toBeInTheDocument(),
    );
    expect(screen.getByText("db-agent")).toBeInTheDocument();
    expect(screen.getByText(/connection refused/)).toBeInTheDocument();
  });

  it("shows no results message when empty", async () => {
    mockInvoke.mockResolvedValue([]);
    render(<SearchPanel open onClose={vi.fn()} onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search output/i), {
      target: { value: "xyz" },
    });
    await waitFor(() =>
      expect(screen.getByText(/no matches/i)).toBeInTheDocument(),
    );
  });

  it("calls onNavigate with session id when result clicked", async () => {
    mockInvoke.mockResolvedValue(mockResults);
    const onNavigate = vi.fn();
    render(<SearchPanel open onClose={vi.fn()} onNavigate={onNavigate} />);
    fireEvent.change(screen.getByPlaceholderText(/search output/i), {
      target: { value: "error" },
    });
    await waitFor(() => screen.getByText(/connection refused/));
    fireEvent.click(screen.getByText(/connection refused/));
    expect(onNavigate).toHaveBeenCalledWith("1");
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<SearchPanel open onClose={onClose} onNavigate={vi.fn()} />);
    fireEvent.keyDown(screen.getByPlaceholderText(/search output/i), {
      key: "Escape",
    });
    expect(onClose).toHaveBeenCalled();
  });
});
