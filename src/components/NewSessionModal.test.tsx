import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NewSessionModal } from "./NewSessionModal";

describe("NewSessionModal", () => {
  it("renders the modal when open", () => {
    render(<NewSessionModal open onClose={vi.fn()} onCreate={vi.fn()} />);
    expect(screen.getByText(/new session/i)).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    const { container } = render(<NewSessionModal open={false} onClose={vi.fn()} onCreate={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("calls onCreate with form values on submit", () => {
    const onCreate = vi.fn();
    render(<NewSessionModal open onClose={vi.fn()} onCreate={onCreate} />);
    fireEvent.change(screen.getByPlaceholderText(/session name/i), { target: { value: "my-feature" } });
    fireEvent.click(screen.getByText(/create/i));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: "my-feature" }));
  });

  it("calls onClose when cancel clicked", () => {
    const onClose = vi.fn();
    render(<NewSessionModal open onClose={onClose} onCreate={vi.fn()} />);
    fireEvent.click(screen.getByText(/cancel/i));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onCreate once when count is 1", () => {
    const onCreate = vi.fn();
    render(<NewSessionModal open onClose={vi.fn()} onCreate={onCreate} />);
    fireEvent.change(screen.getByPlaceholderText(/session name/i), { target: { value: "worker" } });
    fireEvent.click(screen.getByText(/create/i));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: "worker" }));
  });

  it("calls onCreate N times with indexed names when count > 1", () => {
    const onCreate = vi.fn();
    render(<NewSessionModal open onClose={vi.fn()} onCreate={onCreate} />);
    fireEvent.change(screen.getByPlaceholderText(/session name/i), { target: { value: "worker" } });
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "3" } });
    fireEvent.click(screen.getByText(/create/i));
    expect(onCreate).toHaveBeenCalledTimes(3);
    expect(onCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: "worker-1" }));
    expect(onCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({ name: "worker-2" }));
    expect(onCreate).toHaveBeenNthCalledWith(3, expect.objectContaining({ name: "worker-3" }));
  });
});
