export const NOTE_HISTORY_AUTOMATIC_WINDOW_MS = 5 * 60 * 1000
export const NOTE_HISTORY_MAX_SNAPSHOTS_PER_NOTE = 5

interface ComparableHistorySnapshot {
  capturedAt: string
  reason: 'automatic' | 'pre-restore'
  note: unknown
}

function sameState(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function shouldCaptureAutomaticSnapshot(
  currentNote: unknown,
  latest: ComparableHistorySnapshot | null,
  nowMs: number,
): boolean {
  if (!latest) return true
  if (sameState(latest.note, currentNote)) return false
  if (latest.reason !== 'automatic') return true

  const latestMs = Date.parse(latest.capturedAt)
  if (!Number.isFinite(latestMs)) return true
  return nowMs - latestMs >= NOTE_HISTORY_AUTOMATIC_WINDOW_MS
}
