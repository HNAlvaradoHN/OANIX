export type AutoLockMinutes = 1 | 5 | 15 | 60

export const DEFAULT_AUTO_LOCK_MINUTES: AutoLockMinutes = 5
export const AUTO_LOCK_CHANGE_EVENT = 'oanix:auto-lock-change'

export const AUTO_LOCK_OPTIONS: ReadonlyArray<{ minutes: AutoLockMinutes; label: string }> = [
  { minutes: 1, label: '1 min' },
  { minutes: 5, label: '5 min' },
  { minutes: 15, label: '15 min' },
  { minutes: 60, label: '1 h' },
]

const AUTO_LOCK_STORAGE_KEY = 'oanix:auto-lock-minutes:v1'

export function normalizeAutoLockMinutes(value: unknown): AutoLockMinutes {
  const parsed = Number(value)
  return AUTO_LOCK_OPTIONS.some((option) => option.minutes === parsed)
    ? parsed as AutoLockMinutes
    : DEFAULT_AUTO_LOCK_MINUTES
}

export function autoLockDelayMs(minutes: AutoLockMinutes): number {
  return minutes * 60 * 1000
}

export function shouldAutoLockAfterBackground(
  backgroundedAt: number | null,
  now: number,
  minutes: AutoLockMinutes,
): boolean {
  if (backgroundedAt === null) return false
  return Math.max(0, now - backgroundedAt) >= autoLockDelayMs(minutes)
}

export function readSavedAutoLockMinutes(): AutoLockMinutes {
  if (typeof window === 'undefined') return DEFAULT_AUTO_LOCK_MINUTES

  try {
    return normalizeAutoLockMinutes(window.localStorage.getItem(AUTO_LOCK_STORAGE_KEY))
  } catch {
    return DEFAULT_AUTO_LOCK_MINUTES
  }
}

export function saveAutoLockMinutes(minutes: AutoLockMinutes): AutoLockMinutes {
  const normalized = normalizeAutoLockMinutes(minutes)

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(AUTO_LOCK_STORAGE_KEY, String(normalized))
    } catch {
      // The preference is non-sensitive. If storage is unavailable, keep the
      // current in-memory choice for this page without weakening vault crypto.
    }

    window.dispatchEvent(new CustomEvent<AutoLockMinutes>(AUTO_LOCK_CHANGE_EVENT, {
      detail: normalized,
    }))
  }

  return normalized
}
