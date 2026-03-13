import { describe, it, expect } from "vitest";
import { formatRelativeTime, formatDuration } from "./time";

describe("formatRelativeTime", () => {
  const now = new Date("2026-03-12T10:00:00Z");

  it("returns 'just now' for very recent times", () => {
    const ts = new Date(now.getTime() - 30 * 1000).toISOString(); // 30s ago
    expect(formatRelativeTime(ts, now)).toBe("just now");
  });

  it("returns minutes for sub-hour times", () => {
    const ts = new Date(now.getTime() - 5 * 60 * 1000).toISOString(); // 5m ago
    expect(formatRelativeTime(ts, now)).toBe("5m ago");
  });

  it("returns hours for times over an hour", () => {
    const ts = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(); // 2h ago
    expect(formatRelativeTime(ts, now)).toBe("2h ago");
  });

  it("returns days for times over a day", () => {
    const ts = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(); // 25h ago
    expect(formatRelativeTime(ts, now)).toBe("1d ago");
  });

  it("returns 'just now' for empty string", () => {
    expect(formatRelativeTime("", now)).toBe("just now");
  });
});

describe("formatDuration", () => {
  const now = new Date("2026-03-12T10:00:00Z");

  it("returns '<1m' for very short durations", () => {
    const ts = new Date(now.getTime() - 30 * 1000).toISOString();
    expect(formatDuration(ts, now)).toBe("<1m");
  });

  it("returns minutes for sub-hour durations", () => {
    const ts = new Date(now.getTime() - 45 * 60 * 1000).toISOString();
    expect(formatDuration(ts, now)).toBe("45m");
  });

  it("returns hours and minutes for multi-hour durations", () => {
    const ts = new Date(now.getTime() - (2 * 60 + 15) * 60 * 1000).toISOString();
    expect(formatDuration(ts, now)).toBe("2h 15m");
  });

  it("returns days and hours for multi-day durations", () => {
    const ts = new Date(now.getTime() - (25 * 60 * 60 * 1000)).toISOString();
    expect(formatDuration(ts, now)).toBe("1d 1h");
  });

  it("returns empty string for invalid input", () => {
    expect(formatDuration("", now)).toBe("");
    expect(formatDuration("not-a-date", now)).toBe("");
  });
});
