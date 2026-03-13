import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LayoutSwitcher } from "./LayoutSwitcher";

describe("LayoutSwitcher", () => {
  it("renders 1up, 2up, 4up buttons", () => {
    render(<LayoutSwitcher current="1up" onChange={vi.fn()} />);
    expect(screen.getByTitle("1 pane")).toBeInTheDocument();
    expect(screen.getByTitle("2 panes")).toBeInTheDocument();
    expect(screen.getByTitle("4 panes")).toBeInTheDocument();
  });

  it("calls onChange when a different layout clicked", () => {
    const onChange = vi.fn();
    render(<LayoutSwitcher current="1up" onChange={onChange} />);
    fireEvent.click(screen.getByTitle("2 panes"));
    expect(onChange).toHaveBeenCalledWith("2up");
  });

  it("highlights active layout", () => {
    const { container } = render(<LayoutSwitcher current="2up" onChange={vi.fn()} />);
    const active = container.querySelector("[data-active='true']");
    expect(active?.getAttribute("title")).toBe("2 panes");
  });
});
