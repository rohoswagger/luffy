import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { EventLog } from "./EventLog";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }));

const mockEvents = [
  { timestamp: "2026-03-12T00:00:00Z", kind: { type: "Created" } },
  { timestamp: "2026-03-12T01:00:00Z", kind: { type: "StatusChanged", data: { from: "IDLE", to: "THINKING" } } },
  { timestamp: "2026-03-12T02:00:00Z", kind: { type: "CostUpdated", data: { cost_usd: 0.05 } } },
  { timestamp: "2026-03-12T03:00:00Z", kind: { type: "StatusChanged", data: { from: "THINKING", to: "WAITING" } } },
];

describe("EventLog", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("renders loading then events", async () => {
    mockInvoke.mockResolvedValue(mockEvents);
    render(<EventLog sessionId="s1" sessionName="my-agent" />);
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("get_session_events", { sessionId: "s1" }));
    await waitFor(() => expect(screen.getByText(/Created/i)).toBeInTheDocument());
  });

  it("shows status changes", async () => {
    mockInvoke.mockResolvedValue(mockEvents);
    render(<EventLog sessionId="s1" sessionName="my-agent" />);
    await waitFor(() => screen.getByText(/IDLE.*THINKING/));
  });

  it("shows cost updates", async () => {
    mockInvoke.mockResolvedValue(mockEvents);
    render(<EventLog sessionId="s1" sessionName="my-agent" />);
    await waitFor(() => screen.getByText(/\$0\.05/));
  });

  it("shows empty state when no events", async () => {
    mockInvoke.mockResolvedValue([]);
    render(<EventLog sessionId="s1" sessionName="my-agent" />);
    await waitFor(() => screen.getByText(/no events/i));
  });

  it("refetches when sessionId changes", async () => {
    mockInvoke.mockResolvedValue([]);
    const { rerender } = render(<EventLog sessionId="s1" sessionName="a" />);
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("get_session_events", { sessionId: "s1" }));
    rerender(<EventLog sessionId="s2" sessionName="b" />);
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("get_session_events", { sessionId: "s2" }));
  });
});
