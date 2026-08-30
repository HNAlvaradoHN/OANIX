import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { VaultGate } from './VaultGate'
import { WorkspaceRuntimeGate } from './WorkspaceRuntimeGate'
import { NotesWorkspace } from '../features/notes/NotesWorkspace'
import { AccountPanel } from '../features/account/AccountPanel'
import { AutoSyncRuntime } from '../features/sync/AutoSyncRuntime'
import { ConflictCenter } from '../features/sync/ConflictCenter'
import { VersionHistoryCenter } from '../features/versionHistory/VersionHistoryCenter'
import { NotePrivacyRuntime } from '../features/privacy/NotePrivacyRuntime'
import { NoteBulkPrivacyRuntime, NOTE_PRIVACY_REFRESH_EVENT } from '../features/privacy/NoteBulkPrivacyRuntime'
import { PrivateBoxListHint } from '../features/privacy/PrivateBoxListHint'
import { NoteAttachmentsRuntime } from '../features/attachments/NoteAttachmentsRuntime'
import { LargeObjectTransferIndicator } from '../features/largeObjects/LargeObjectTransferIndicator'
import { AndroidAuthRuntime } from '../platform/android/AndroidAuthRuntime'
import { NativeCameraRuntime } from '../platform/android/NativeCameraRuntime'
import { NativeDocumentsRuntime } from '../platform/android/NativeDocumentsRuntime'
import { NativeShareRuntime } from '../platform/android/NativeShareRuntime'
import { NativeNoteShareRuntime } from '../platform/android/NativeNoteShareRuntime'
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
import { OanixIcon } from '../shared/OanixIcon'

type OanixUpdateWindow = Window & {
  __oanixApplyUpdate?: () => Promise<void>
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
}

async function prepareVisibleWorkspaceForUpdate() {
  const focused = document.activeElement
  if (focused instanceof HTMLElement) focused.blur()

  const deadline = Date.now() + 6000
  while (Date.now() < deadline) {
    const saveStatus = document.querySelector<HTMLElement>('.save-status')?.textContent?.trim() ?? ''

    if (!saveStatus) return true
    if (/no se pudo guardar/i.test(saveStatus)) return false
    if (!/cambios pendientes|guardando/i.test(saveStatus)) return true

    await wait(120)
  }

  return false
}

function UnlockedApp({ lockVault }: { lockVault: () => void }) {
  const [accountOpen, setAccountOpen] = useState(false)
  const [accountHost, setAccountHost] = useState<HTMLElement | null>(null)
  const [workspaceRevision, setWorkspaceRevision] = useState(0)
  const [privacyRevision, setPrivacyRevision] = useState(0)

  useEffect(() => {
    setAccountHost(null)
    const frame = window.requestAnimationFrame(() => {
      setAccountHost(document.querySelector<HTMLElement>('.notes-header__actions'))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const refreshPrivacy = () => setPrivacyRevision((value) => value + 1)
    window.addEventListener(NOTE_PRIVACY_REFRESH_EVENT, refreshPrivacy)
    return () => window.removeEventListener(NOTE_PRIVACY_REFRESH_EVENT, refreshPrivacy)
  }, [])

  useEffect(() => {
    const refreshWorkspace = () => setWorkspaceRevision((value) => value + 1)
    window.addEventListener('oanix:workspace-refresh', refreshWorkspace)
    return () => window.removeEventListener('oanix:workspace-refresh', refreshWorkspace)
  }, [])

  return (
    <>
      <AutoSyncRuntime onRemoteApplied={() => setWorkspaceRevision((value) => value + 1)} />
      <AndroidBackRuntime />
      <NativeCameraRuntime />
      <NativeShareRuntime onImported={() => setWorkspaceRevision((value) => value + 1)} />
      <NativeNoteShareRuntime />
      <AndroidKeystoreDiagnosticRuntime />
      <NotesWorkspace refreshRevision={workspaceRevision} onLock={lockVault} />
      <WorkspaceRuntimeGate workspaceRevision={workspaceRevision} />
      <NoteAttachmentsRuntime key={`attachments-${workspaceRevision}`} />
      <NotePrivacyRuntime key={`privacy-${workspaceRevision}-${privacyRevision}`} />
      <NoteBulkPrivacyRuntime key={`privacy-bulk-${workspaceRevision}`} />
      <PrivateBoxListHint key={`private-hint-${workspaceRevision}`} />
      <ConflictCenter onResolved={() => setWorkspaceRevision((value) => value + 1)} />
      <VersionHistoryCenter onRestored={() => setWorkspaceRevision((value) => value + 1)} />
      <LargeObjectTransferIndicator />
      {accountHost && createPortal(
        <button
          className="icon-button account-header-action"
          type="button"
          onClick={() => setAccountOpen(true)}
          aria-label="Cuenta de OANIX"
          title="Cuenta de OANIX"
        >
          <OanixIcon name="user" />
        </button>,
        accountHost,
      )}
      {accountOpen && <AccountPanel onClose={() => setAccountOpen(false)} />}
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
