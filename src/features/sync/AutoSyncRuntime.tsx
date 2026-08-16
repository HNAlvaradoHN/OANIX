import { useEffect, useRef } from 'react'
import {
  getOnlineAccountSession,
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
    let timeoutId = 0

    const schedule = (delay = 650) => {
      if (disposed) return
      window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => void runSync(), delay)
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

      const session = await getOnlineAccountSession().catch(() => null)
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
          schedule(250)
        }
      }
    }

    const handleLocalChange = (event: Event) => {
      const detail = (event as CustomEvent<LocalChangeDetail>).detail
      if (detail?.recordType === 'system.sync-state' || detail?.recordType === 'system.encryption-check') return
      schedule()
    }
    const handleOnline = () => schedule(0)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') schedule(0)
    }

    const unsubscribe = subscribeOnlineAccountSession((session) => {
      if (session) schedule(150)
      else emitSyncStatus('idle', 'Modo local. Conecta una cuenta para sincronizar automáticamente entre dispositivos.')
    })

    window.addEventListener('oanix:local-data-changed', handleLocalChange)
    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisibility)
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') schedule(0)
    }, 30_000)

    schedule(350)

    return () => {
      disposed = true
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
      unsubscribe()
      window.removeEventListener('oanix:local-data-changed', handleLocalChange)
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return null
}
