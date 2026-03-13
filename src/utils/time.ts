/**
 * Format an ISO timestamp as a relative time string ("just now", "5m ago", "2h ago", "1d ago").
 * @param isoString - ISO 8601 timestamp string (empty string treated as now)
 * @param now - reference time (defaults to current time, injectable for tests)
 */
export function formatRelativeTime(isoString: string, now: Date = new Date()): string {
  if (!isoString) return "just now";
  const then = new Date(isoString);
  if (isNaN(then.getTime())) return "just now";

  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}
