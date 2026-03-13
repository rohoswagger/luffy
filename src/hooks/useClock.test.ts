import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useClock } from "./useClock";

describe("useClock", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns a Date object", () => {
    const { result } = renderHook(() => useClock());
    expect(result.current).toBeInstanceOf(Date);
  });

  it("updates every 30 seconds", () => {
    const { result } = renderHook(() => useClock());
    const initial = result.current.getTime();
    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.getTime()).toBeGreaterThan(initial);
  });

  it("accepts a custom interval", () => {
    const { result } = renderHook(() => useClock(10_000));
    const initial = result.current.getTime();
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.getTime()).toBeGreaterThan(initial);
  });

  it("does not update before interval elapses", () => {
    const { result } = renderHook(() => useClock());
    const initial = result.current.getTime();
    act(() => vi.advanceTimersByTime(15_000));
    expect(result.current.getTime()).toBe(initial);
  });
});
