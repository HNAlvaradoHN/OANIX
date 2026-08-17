import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  canUseAndroidBiometricUnlock,
  unlockLocalVaultWithBiometrics,
  verifyLocalEncryption,
} from '../../security/vault/vaultService'

interface AndroidBiometricRetryRuntimeProps {
  onUnlocked: () => void
}

export function AndroidBiometricRetryRuntime({ onUnlocked }: AndroidBiometricRetryRuntimeProps) {
  const [target, setTarget] = useState<HTMLFormElement | null>(null)
  const [available, setAvailable] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true

    const refresh = () => {
      const passwordInput = document.querySelector<HTMLInputElement>('#master-password')
      const form = passwordInput?.closest('form') ?? null
      setTarget(form)

      if (!form) {
        setAvailable(false)
        return
      }

      void canUseAndroidBiometricUnlock()
        .then((value) => {
          if (active) setAvailable(value)
        })
        .catch(() => {
          if (active) setAvailable(false)
        })
    }

    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('focus', refresh)

    return () => {
      active = false
      observer.disconnect()
      window.removeEventListener('focus', refresh)
    }
  }, [])

  if (!target || !available) return null

  async function handleRetry() {
    if (busy) return
    setBusy(true)

    try {
      // The native biometric vault prompt already authorizes BIOMETRIC_STRONG | DEVICE_CREDENTIAL.
      // Android decides whether the user completes it with fingerprint or the device PIN/pattern/
      // password; OANIX never receives that credential.
      const result = await unlockLocalVaultWithBiometrics()
      if (result.status === 'error') return

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
      onClick={() => void handleRetry()}
      disabled={busy}
      aria-label="Usar PIN, patrón, contraseña del teléfono o huella para desbloquear OANIX"
      title="Usar seguridad del teléfono"
      style={{ marginTop: '.35rem' }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M6.4 10.2A5.7 5.7 0 0 1 12 5.4a5.7 5.7 0 0 1 5.6 4.8" />
        <path d="M4.5 10.4A7.6 7.6 0 0 1 12 3.6a7.6 7.6 0 0 1 7.5 6.8" />
        <path d="M8.2 11.1A3.8 3.8 0 0 1 12 7.8a3.8 3.8 0 0 1 3.8 3.3" />
        <path d="M6.8 13.1c.2 3.5 1.4 6 3.5 7.3" />
        <path d="M10.1 11.5c0 4.2.7 7.1 2.1 9" />
        <path d="M13.9 11.5c0 3.6-.3 6.4-1 8.6" />
        <path d="M17.2 13.1c-.1 2.7-.7 5-1.8 6.8" />
      </svg>
      <span>{busy ? 'Comprobando…' : 'Usar PIN, patrón o huella'}</span>
    </button>,
    target,
  )
}
