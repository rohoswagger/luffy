import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TemplatesPanel } from "./TemplatesPanel";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const mockTemplates = [
  {
    id: "t1",
    name: "auth-worker",
    agent_type: "claude-code",
    working_dir: "/repo",
    count: 3,
  },
  {
    id: "t2",
    name: "quick-fix",
    agent_type: "aider",
    working_dir: null,
    count: 1,
  },
];

describe("TemplatesPanel", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("loads and displays templates", async () => {
    mockInvoke.mockResolvedValue(mockTemplates);
    render(<TemplatesPanel open onClose={vi.fn()} onLaunch={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText("auth-worker")).toBeInTheDocument(),
    );
    expect(screen.getByText("quick-fix")).toBeInTheDocument();
  });

  it("calls onLaunch with template data when launch clicked", async () => {
    mockInvoke.mockResolvedValue(mockTemplates);
    const onLaunch = vi.fn();
    render(<TemplatesPanel open onClose={vi.fn()} onLaunch={onLaunch} />);
    await waitFor(() => screen.getByText("auth-worker"));
    fireEvent.click(screen.getAllByRole("button", { name: /launch/i })[0]);
    expect(onLaunch).toHaveBeenCalledWith(
      expect.objectContaining({ name: "auth-worker", count: 3 }),
    );
  });

  it("calls delete_template invoke when delete clicked", async () => {
    mockInvoke
      .mockResolvedValueOnce(mockTemplates)
      .mockResolvedValueOnce([mockTemplates[1]]);
    render(<TemplatesPanel open onClose={vi.fn()} onLaunch={vi.fn()} />);
    await waitFor(() => screen.getAllByRole("button", { name: /delete/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /delete/i })[0]);
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("delete_template", {
        templateId: "t1",
      }),
    );
  });

  it("shows empty state when no templates", async () => {
    mockInvoke.mockResolvedValue([]);
    render(<TemplatesPanel open onClose={vi.fn()} onLaunch={vi.fn()} />);
    await waitFor(() => screen.getByText(/no templates/i));
  });

  it("does not render when closed", () => {
    const { container } = render(
      <TemplatesPanel open={false} onClose={vi.fn()} onLaunch={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
