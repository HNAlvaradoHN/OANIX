import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { verifyLocalEncryption } from '../../security/vault/vaultService'
import {
  canUseAndroidDeviceCredentialUnlock,
  unlockLocalVaultWithDeviceCredential,
} from './deviceCredentialVault'

interface AndroidDeviceCredentialRetryRuntimeProps {
  onUnlocked: () => void
}

export function AndroidDeviceCredentialRetryRuntime({
  onUnlocked,
}: AndroidDeviceCredentialRetryRuntimeProps) {
  const [target, setTarget] = useState<HTMLFormElement | null>(null)
  const [available, setAvailable] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    let currentForm: HTMLFormElement | null = null

    const refresh = (forceAvailabilityCheck = false) => {
      const passwordInput = document.querySelector<HTMLInputElement>('#master-password')
      const form = passwordInput?.closest('form') ?? null
      const formChanged = form !== currentForm
      currentForm = form
      setTarget(form)

      if (!form) {
        setAvailable(false)
        return
      }

      if (!formChanged && !forceAvailabilityCheck) return

      void canUseAndroidDeviceCredentialUnlock()
        .then((value) => {
          if (active) setAvailable(value)
        })
        .catch(() => {
          if (active) setAvailable(false)
        })
    }

    refresh()
    const appRoot = document.getElementById('root')
    const observer = appRoot ? new MutationObserver(() => refresh()) : null
    if (appRoot && observer) {
      observer.observe(appRoot, { childList: true, subtree: true })
    }
    const handleFocus = () => refresh(true)
    window.addEventListener('focus', handleFocus)

    return () => {
      active = false
      observer?.disconnect()
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  if (!target || !available) return null

  async function handleUnlock() {
    if (busy) return
    setBusy(true)

    try {
      if (!(await unlockLocalVaultWithDeviceCredential())) return

      const verification = await verifyLocalEncryption()
      if (verification.status === 'error') return

      onUnlocked()
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <button
      type="button"
      className="vault-restore__button"
      onClick={() => void handleUnlock()}
      disabled={busy}
      aria-label="Desbloquear OANIX con PIN, patrón o contraseña del teléfono"
      title="Usar bloqueo del teléfono"
      style={{ marginTop: '.35rem' }}
    >
      <span aria-hidden="true">▦</span>
      <span>{busy ? 'Comprobando…' : 'Usar PIN o patrón del teléfono'}</span>
    </button>,
    target,
  )
}
