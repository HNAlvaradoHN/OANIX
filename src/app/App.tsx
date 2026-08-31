import { useEffect, useRef, useState } from 'react'
import { VaultGate } from './VaultGate'
import { RebuildApp } from '../features/rebuild/RebuildApp'
import { AndroidAuthRuntime } from '../platform/android/AndroidAuthRuntime'
import { NativeDocumentsRuntime } from '../platform/android/NativeDocumentsRuntime'
import { AndroidBackRuntime } from '../platform/android/AndroidBackRuntime'
import { AndroidBiometricRetryRuntime } from '../platform/android/AndroidBiometricRetryRuntime'
import { AndroidKeystoreDiagnosticRuntime } from '../platform/android/AndroidKeystoreDiagnosticRuntime'
import { isAndroidBiometricRuntime } from '../platform/android/biometricVault'
import { isAndroidSystemInteractionActive } from '../platform/android/systemInteractionGuard'
import {
  AUTO_LOCK_CHANGE_EVENT,
  autoLockDelayMs,
  readSavedAutoLockMinutes,
  shouldAutoLockAfterBackground,
  type AutoLockMinutes,
} from '../security/session/autoLockPolicy'
import { lockLocalVault } from '../security/vault/vaultService'

type OanixUpdateWindow = Window & {
  __oanixApplyUpdate?: () => Promise<void>
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
}

async function prepareVisibleWorkspaceForUpdate() {
  const focused = document.activeElement
  if (focused instanceof HTMLElement) focused.blur()

  const dirtyEditor = document.querySelector<HTMLElement>('[data-oanix-unsaved="true"]')
  if (dirtyEditor) {
    document.querySelector<HTMLButtonElement>('[data-oanix-save-and-close="true"]')?.click()
  }

  const deadline = Date.now() + 6000
  while (Date.now() < deadline) {
    if (document.querySelector('[data-oanix-unsaved="true"]')) {
      await wait(120)
      continue
    }

    const saveStatus = document.querySelector<HTMLElement>('.save-status')?.textContent?.trim() ?? ''
    if (!saveStatus) return true
    if (/no se pudo guardar/i.test(saveStatus)) return false
    if (!/cambios pendientes|guardando/i.test(saveStatus)) return true

    await wait(120)
  }

  return false
}

function UnlockedApp({ lockVault }: { lockVault: () => void }) {
  return (
    <>
      <AndroidBackRuntime />
      <AndroidKeystoreDiagnosticRuntime />
      <RebuildApp onLock={lockVault} />
    </>
  )
}

export function App() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState('')
  const [vaultGateRevision, setVaultGateRevision] = useState(0)
  const backgroundedAt = useRef<number | null>(null)
  const backgroundAutoLocked = useRef(false)
  const autoLockTimer = useRef<number | null>(null)
  const autoLockMinutes = useRef<AutoLockMinutes>(readSavedAutoLockMinutes())

  useEffect(() => {
    const updateWindow = window as OanixUpdateWindow
    const showUpdate = () => setUpdateAvailable(typeof updateWindow.__oanixApplyUpdate === 'function')

    showUpdate()
    window.addEventListener('oanix:update-available', showUpdate)
    return () => window.removeEventListener('oanix:update-available', showUpdate)
  }, [])

  useEffect(() => {
    if (!isAndroidBiometricRuntime()) return

    function clearAutoLockTimer() {
      if (autoLockTimer.current === null) return
      window.clearTimeout(autoLockTimer.current)
      autoLockTimer.current = null
    }

    function lockAfterGracePeriod() {
      if (backgroundedAt.current === null) return
      lockLocalVault()
      backgroundAutoLocked.current = true
      autoLockTimer.current = null
    }

    function scheduleAutoLock() {
      clearAutoLockTimer()
      const hiddenAt = backgroundedAt.current
      if (hiddenAt === null) return

      const remaining = autoLockDelayMs(autoLockMinutes.current) - Math.max(0, Date.now() - hiddenAt)
      if (remaining <= 0) {
        lockAfterGracePeriod()
        return
      }

      autoLockTimer.current = window.setTimeout(lockAfterGracePeriod, remaining)
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        if (isAndroidSystemInteractionActive()) return

        backgroundedAt.current = Date.now()
        backgroundAutoLocked.current = false
        scheduleAutoLock()
        return
      }

      if (document.visibilityState !== 'visible' || backgroundedAt.current === null) return

      clearAutoLockTimer()
      if (
        !backgroundAutoLocked.current
        && shouldAutoLockAfterBackground(backgroundedAt.current, Date.now(), autoLockMinutes.current)
      ) {
        lockLocalVault()
        backgroundAutoLocked.current = true
      }

      const needsLockedGate = backgroundAutoLocked.current
      backgroundedAt.current = null
      backgroundAutoLocked.current = false

      if (needsLockedGate) {
        setVaultGateRevision((value) => value + 1)
      }
    }

    function handleAutoLockPreferenceChange(event: Event) {
      const next = (event as CustomEvent<AutoLockMinutes>).detail
      autoLockMinutes.current = next ?? readSavedAutoLockMinutes()
      if (backgroundedAt.current !== null) scheduleAutoLock()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener(AUTO_LOCK_CHANGE_EVENT, handleAutoLockPreferenceChange)
    return () => {
      clearAutoLockTimer()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener(AUTO_LOCK_CHANGE_EVENT, handleAutoLockPreferenceChange)
    }
  }, [])

  async function handleApplyUpdate() {
    if (updating) return
    setUpdating(true)
    setUpdateError('')

    try {
      const safeToReload = await prepareVisibleWorkspaceForUpdate()
      if (!safeToReload) {
        setUpdateError('No se pudo confirmar el guardado. Revisa la nota e inténtalo otra vez.')
        setUpdating(false)
        return
      }

      const applyUpdate = (window as OanixUpdateWindow).__oanixApplyUpdate
      if (!applyUpdate) {
        setUpdateAvailable(false)
        setUpdating(false)
        return
      }

      await applyUpdate()
    } catch {
      setUpdateError('No se pudo aplicar la nueva versión. OANIX sigue funcionando con la versión actual.')
      setUpdating(false)
    }
  }

  return (
    <>
      <AndroidAuthRuntime />
      <NativeDocumentsRuntime />
      <VaultGate
        key={vaultGateRevision}
        renderUnlocked={(lockVault) => <UnlockedApp lockVault={lockVault} />}
      />
      <AndroidBiometricRetryRuntime
        onUnlocked={() => setVaultGateRevision((value) => value + 1)}
      />

      {updateAvailable && (
        <aside
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            zIndex: 2600,
            top: 'max(.65rem, env(safe-area-inset-top))',
            left: '50%',
            width: 'min(34rem, calc(100vw - 1rem))',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '.65rem',
            padding: '.7rem .8rem',
            border: '1px solid rgba(148,163,184,.28)',
            borderRadius: '.9rem',
            background: 'rgba(15,23,42,.96)',
            color: '#eef5ff',
            boxShadow: '0 16px 45px rgba(0,0,0,.3)',
            backdropFilter: 'blur(14px)',
          }}
        >
          <span style={{ minWidth: 0, flex: '1 1 13rem', fontSize: '.8rem', lineHeight: 1.4 }}>
            {updateError || 'Nueva versión disponible.'}
          </span>
          <button
            type="button"
            onClick={() => void handleApplyUpdate()}
            disabled={updating}
            style={{
              minHeight: '2.35rem',
              padding: '.45rem .75rem',
              border: '1px solid rgba(143,176,255,.55)',
              borderRadius: '.65rem',
              background: 'rgba(79,112,219,.18)',
              color: '#dbe7ff',
              fontWeight: 850,
            }}
          >
            {updating ? 'Actualizando…' : 'Actualizar'}
          </button>
        </aside>
      )}
    </>
  )
}
