import { useEffect, useRef } from 'react'
import { getOnlineDataClient } from '../account/accountService'
import { runV2IncrementalSync } from './v2SyncCoordinator'

const IDLE_DELAY_MS = 3000
const REMOTE_POLL_MS = 60000

interface V2AutoSyncRuntimeProps {
  onRemoteApplied?: () => void
}

function workspaceIsSafeForSync(): boolean {
  if (!navigator.onLine) return false
  if (document.visibilityState !== 'visible') return false
  // This button exists for the full lifetime of an opened editor, even when the editor is clean.
  // Never apply remote changes while a note is open: the in-memory editor remains authoritative.
  if (document.querySelector('[data-oanix-save-and-close="true"]')) return false
  if (document.querySelector('[data-oanix-unsaved="true"]')) return false
  return true
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/**
 * Incremental remote sync runtime.
 *
 * Heavy work is intentionally postponed while a note editor is open. User activity
 * aborts an in-flight run and restarts the idle window, so a remote apply never races
 * an active editing session. The periodic check only asks Supabase for change_seq rows
 * newer than the encrypted local cursor; unchanged payloads are not downloaded.
 */
export function V2AutoSyncRuntime({ onRemoteApplied }: V2AutoSyncRuntimeProps) {
  const idleTimerRef = useRef<number | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const runningRef = useRef(false)
  const rerunRef = useRef(false)

  useEffect(() => {
    let disposed = false

    const clearIdleTimer = () => {
      if (idleTimerRef.current === null) return
      window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }

    const abortCurrentRun = () => {
      controllerRef.current?.abort()
      controllerRef.current = null
    }

    const run = async () => {
      idleTimerRef.current = null
      if (disposed || !workspaceIsSafeForSync()) return
      if (runningRef.current) {
        rerunRef.current = true
        return
      }

      runningRef.current = true
      rerunRef.current = false
      const controller = new AbortController()
      controllerRef.current = controller

      try {
        const result = await runV2IncrementalSync(controller.signal)
        if (
          !disposed
          && !controller.signal.aborted
          && (result.downloaded > 0 || result.deletedLocal > 0)
        ) {
          onRemoteApplied?.()
        }
      } catch (error) {
        if (!isAbortError(error)) {
          console.warn('OANIX sync v2 deferred after a non-destructive failure.', error)
        }
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null
        runningRef.current = false
        if (!disposed && rerunRef.current) schedule()
      }
    }

    const schedule = () => {
      if (disposed) return
      clearIdleTimer()
      idleTimerRef.current = window.setTimeout(() => void run(), IDLE_DELAY_MS)
    }

    const handleActivity = () => {
      abortCurrentRun()
      schedule()
    }

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') {
        clearIdleTimer()
        abortCurrentRun()
        return
      }
      schedule()
    }

    const handleOffline = () => {
      clearIdleTimer()
      abortCurrentRun()
    }

    const supabase = getOnlineDataClient()
    const { data: authSubscription } = supabase.auth.onAuthStateChange(() => schedule())

    window.addEventListener('online', schedule)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('pointerdown', handleActivity, { passive: true })
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('input', handleActivity)
    document.addEventListener('visibilitychange', handleVisibility)

    const pollTimer = window.setInterval(() => {
      if (workspaceIsSafeForSync()) schedule()
    }, REMOTE_POLL_MS)

    schedule()

    return () => {
      disposed = true
      clearIdleTimer()
      abortCurrentRun()
      window.clearInterval(pollTimer)
      authSubscription.subscription.unsubscribe()
      window.removeEventListener('online', schedule)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('pointerdown', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('input', handleActivity)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [onRemoteApplied])

  return null
}
