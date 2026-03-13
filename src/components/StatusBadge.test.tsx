import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders THINKING status", () => {
    render(<StatusBadge status="THINKING" />);
    expect(screen.getByText("THINKING")).toBeInTheDocument();
  });

  it("renders WAITING status", () => {
    render(<StatusBadge status="WAITING" />);
    expect(screen.getByText("WAITING")).toBeInTheDocument();
  });

  it("renders ERROR with status dot", () => {
    const { container } = render(<StatusBadge status="ERROR" />);
    expect(screen.getByText("ERROR")).toBeInTheDocument();
    expect(container.querySelector(".status-dot")).toBeTruthy();
  });

  it("renders IDLE without pulsing", () => {
    const { container } = render(<StatusBadge status="IDLE" />);
    expect(screen.getByText("IDLE")).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeFalsy();
  });
});
