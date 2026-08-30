import { useEffect, useRef } from 'react'
import {
  getOnlineAccountSession,
  getOnlineDataClient,
  subscribeOnlineAccountSession,
} from '../account/accountService'
import { syncEncryptedBinariesBidirectional } from './binarySyncService'
import { syncEncryptedVaultBidirectional } from './syncService'

interface AutoSyncRuntimeProps {
  onRemoteApplied: () => void
}

interface LocalChangeDetail {
  recordType?: string
}

type SyncStatusKind = 'idle' | 'syncing' | 'synced' | 'offline' | 'conflict' | 'error'

function emitSyncStatus(kind: SyncStatusKind, message: string) {
  window.dispatchEvent(new CustomEvent('oanix:sync-status', {
    detail: { kind, message, at: new Date().toISOString() },
  }))
}

export function AutoSyncRuntime({ onRemoteApplied }: AutoSyncRuntimeProps) {
  const onRemoteAppliedRef = useRef(onRemoteApplied)
  onRemoteAppliedRef.current = onRemoteApplied

  useEffect(() => {
    let disposed = false
    let running = false
    let runAgain = false
    let forceNextRun = false
    let timeoutId = 0
    let realtimeUserId: string | null = null
    let cleanupRealtime = () => undefined

    const schedule = (delay = 250) => {
      if (disposed) return
      window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => void runSync(), delay)
    }

    const bindRealtime = (userId: string | null) => {
      if (realtimeUserId === userId) return

      cleanupRealtime()
      cleanupRealtime = () => undefined
      realtimeUserId = userId
      if (!userId) return

      const client = getOnlineDataClient()
      const channel = client
        .channel(`oanix-sync-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'sync_records',
            filter: `user_id=eq.${userId}`,
          },
          () => schedule(60),
        )
        .subscribe()

      cleanupRealtime = () => {
        void client.removeChannel(channel)
      }
    }

    const runSync = async () => {
      if (disposed) return
      if (running) {
        runAgain = true
        return
      }

      if (!navigator.onLine) {
        emitSyncStatus('offline', 'Sin conexión. Los cambios siguen guardándose localmente y se sincronizarán al volver Internet.')
        return
      }

      if (!forceNextRun && document.querySelector('.notes-shell--open')) {
        schedule(900)
        return
      }
      forceNextRun = false

      const session = await getOnlineAccountSession().catch(() => null)
      bindRealtime(session?.userId ?? null)
      if (!session) {
        emitSyncStatus('idle', 'Modo local. Conecta una cuenta para sincronizar automáticamente entre dispositivos.')
        return
      }

      running = true
      emitSyncStatus('syncing', 'Sincronizando datos e imágenes cifradas…')
      try {
        const records = await syncEncryptedVaultBidirectional()
        if (records.downloaded > 0 || records.deletedLocal > 0) {
          onRemoteAppliedRef.current()
        }

        const binaries = await syncEncryptedBinariesBidirectional()
        if (binaries.downloaded > 0 || binaries.deletedLocal > 0) {
          onRemoteAppliedRef.current()
        }

        const conflicts = records.conflicts + binaries.conflicts
        if (conflicts > 0) {
          emitSyncStatus(
            'conflict',
            `${conflicts} cambio${conflicts === 1 ? '' : 's'} requiere${conflicts === 1 ? '' : 'n'} resolución antes de sobrescribir datos.`,
          )
        } else {
          const changed =
            records.uploaded + records.downloaded + records.deletedRemote + records.deletedLocal +
            binaries.uploaded + binaries.downloaded + binaries.deletedRemote + binaries.deletedLocal
          emitSyncStatus(
            'synced',
            changed > 0
              ? `Sincronización E2EE al día · ${changed} cambio${changed === 1 ? '' : 's'} aplicado${changed === 1 ? '' : 's'}, incluidas imágenes.`
              : 'Sincronización E2EE al día · datos e imágenes protegidos.',
          )
        }
      } catch (error) {
        emitSyncStatus(
          'error',
          error instanceof Error ? error.message : 'No se pudo completar la sincronización automática.',
        )
      } finally {
        running = false
        if (runAgain && !disposed) {
          runAgain = false
          schedule(120)
        }
      }
    }

    const handleLocalChange = (event: Event) => {
      const detail = (event as CustomEvent<LocalChangeDetail>).detail
      if (detail?.recordType === 'system.sync-state' || detail?.recordType === 'system.encryption-check') return
      schedule()
    }
    const handleOnline = () => schedule(0)
    const handleManualSync = () => {
      forceNextRun = true
      schedule(0)
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') schedule(0)
    }

    const unsubscribe = subscribeOnlineAccountSession((session) => {
      bindRealtime(session?.userId ?? null)
      if (session) schedule(80)
      else emitSyncStatus('idle', 'Modo local. Conecta una cuenta para sincronizar automáticamente entre dispositivos.')
    })

    window.addEventListener('oanix:local-data-changed', handleLocalChange)
    window.addEventListener('oanix:sync-now', handleManualSync)
    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisibility)

    // Do not poll the complete encrypted vault while the app is idle. Remote
    // mutations already arrive through Supabase Realtime; local writes, online
    // recovery and foregrounding are explicit sync triggers. The old 30-second
    // full sync repeatedly downloaded remote ciphertext and re-hashed local
    // binary payloads even when the user was only reading a folder.
    schedule(1200)

    return () => {
      disposed = true
      window.clearTimeout(timeoutId)
      cleanupRealtime()
      unsubscribe()
      window.removeEventListener('oanix:local-data-changed', handleLocalChange)
      window.removeEventListener('oanix:sync-now', handleManualSync)
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return null
}
