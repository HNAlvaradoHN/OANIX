import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { VaultGate } from './VaultGate'
import { NotesWorkspace } from '../features/notes/NotesWorkspace'
import { AccountPanel } from '../features/account/AccountPanel'
import { AutoSyncRuntime } from '../features/sync/AutoSyncRuntime'
import { ConflictCenter } from '../features/sync/ConflictCenter'
import { VersionHistoryCenter } from '../features/versionHistory/VersionHistoryCenter'
import { NativeCameraRuntime } from '../platform/android/NativeCameraRuntime'
import { NativeDocumentsRuntime } from '../platform/android/NativeDocumentsRuntime'

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

  useEffect(() => {
    setAccountHost(null)
    const frame = window.requestAnimationFrame(() => {
      setAccountHost(document.querySelector<HTMLElement>('.notes-header__actions'))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [workspaceRevision])

  return (
    <>
      <AutoSyncRuntime onRemoteApplied={() => setWorkspaceRevision((value) => value + 1)} />
      <NativeCameraRuntime />
      <NotesWorkspace key={workspaceRevision} onLock={lockVault} />
      <ConflictCenter onResolved={() => setWorkspaceRevision((value) => value + 1)} />
      <VersionHistoryCenter onRestored={() => setWorkspaceRevision((value) => value + 1)} />
      {accountHost && createPortal(
        <button
          className="icon-button account-header-action"
          type="button"
          onClick={() => setAccountOpen(true)}
          aria-label="Cuenta de OANIX"
          title="Cuenta de OANIX"
        >
          👤
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

  useEffect(() => {
    const updateWindow = window as OanixUpdateWindow
    const showUpdate = () => setUpdateAvailable(typeof updateWindow.__oanixApplyUpdate === 'function')

    showUpdate()
    window.addEventListener('oanix:update-available', showUpdate)
    return () => window.removeEventListener('oanix:update-available', showUpdate)
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
      <NativeDocumentsRuntime />
      <VaultGate
        renderUnlocked={(lockVault) => <UnlockedApp lockVault={lockVault} />}
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
