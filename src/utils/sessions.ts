import type { SessionData } from "../store/sessions";

const STATUS_PRIORITY: Record<SessionData["status"], number> = {
  WAITING: 0,
  THINKING: 1,
  IDLE: 2,
  ERROR: 3,
  DONE: 4,
};

/**
 * Sort sessions by priority: WAITING > THINKING > IDLE > ERROR > DONE.
 * Stable sort — preserves relative order within the same status.
 */
export function sortSessionsByPriority(sessions: SessionData[]): SessionData[] {
  return [...sessions].sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);
}

/**
 * Find the next session that needs attention (WAITING status).
 * Cycles through waiting sessions. If currentId is one of them, returns the next one.
 * Returns null if no WAITING sessions exist.
 */
export function nextWaitingSessionId(sessions: SessionData[], currentId: string | null): string | null {
  const waiting = sessions.filter((s) => s.status === "WAITING");
  if (waiting.length === 0) return null;
  if (!currentId) return waiting[0].id;
  const idx = waiting.findIndex((s) => s.id === currentId);
  if (idx === -1) return waiting[0].id;
  return waiting[(idx + 1) % waiting.length].id;
}
