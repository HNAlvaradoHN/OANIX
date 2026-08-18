import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ensureAndroidDeviceKey,
  getAndroidKeystoreStatus,
  isAndroidKeystoreRuntime,
  openWithAndroidKeystore,
  sealWithAndroidKeystore,
} from './keystore'

const SELF_TEST_PURPOSE = 'oanix.keystore.self-test.v1'
const WRONG_PURPOSE = 'oanix.keystore.self-test.invalid-purpose'

function secureChallenge(): string {
  if (globalThis.crypto?.randomUUID) return `oanix-keystore-${globalThis.crypto.randomUUID()}`

  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Este dispositivo no ofrece generación aleatoria segura para la prueba.')
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(24))
  return `oanix-keystore-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

export function AndroidKeystoreDiagnosticRuntime() {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isAndroidKeystoreRuntime()) return

    const refresh = () => {
      const nextTarget = document.querySelector<HTMLElement>('.workspace-menu')
      setTarget((current) => current === nextTarget ? current : nextTarget)
    }

    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  if (!target || !isAndroidKeystoreRuntime()) return null

  async function verifyKeystore() {
    if (busy) return
    setBusy(true)

    try {
      await ensureAndroidDeviceKey()
      const challenge = secureChallenge()
      const envelope = await sealWithAndroidKeystore(challenge, SELF_TEST_PURPOSE)
      const opened = await openWithAndroidKeystore(envelope, SELF_TEST_PURPOSE)

      if (opened !== challenge) {
        throw new Error('Android Keystore devolvió datos distintos a los protegidos.')
      }

      let wrongPurposeRejected = false
      try {
        await openWithAndroidKeystore(envelope, WRONG_PURPOSE)
      } catch {
        wrongPurposeRejected = true
      }

      if (!wrongPurposeRejected) {
        throw new Error('La prueba de asociación criptográfica al propósito no fue rechazada.')
      }

      const status = await getAndroidKeystoreStatus()
      if (!status.available || !status.keyExists || status.aliasVersion !== 1) {
        throw new Error('La clave de dispositivo no quedó disponible como se esperaba.')
      }

      window.alert(
        'Android Keystore verificado correctamente.\n\n' +
        'Cifrar y abrir: OK\n' +
        'Protección por propósito (AAD): OK\n' +
        'Clave del dispositivo: alias v1 disponible\n\n' +
        'La prueba usó un valor aleatorio temporal y no guardó su texto ni la envoltura.',
      )
    } catch (error) {
      window.alert(
        error instanceof Error
          ? `No se pudo verificar Android Keystore.\n\n${error.message}`
          : 'No se pudo verificar Android Keystore en este dispositivo.',
      )
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <button
      type="button"
      role="menuitem"
      disabled={busy}
      onClick={() => void verifyKeystore()}
    >
      <span aria-hidden="true">🛡</span> {busy ? 'Verificando protección…' : 'Verificar protección Android'}
    </button>,
    target,
  )
}
