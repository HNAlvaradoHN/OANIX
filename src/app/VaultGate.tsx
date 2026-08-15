import { useEffect, useState, type FormEvent } from 'react'
import {
  createMasterPassword,
  initializeLocalVault,
  lockLocalVault,
  MASTER_PASSWORD_MIN_CHARACTERS,
  unlockLocalVault,
  verifyLocalEncryption,
} from '../security/vault/vaultService'

type GateState = 'checking' | 'setup' | 'locked' | 'unlocked' | 'error'

export function VaultGate() {
  const [state, setState] = useState<GateState>('checking')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    let active = true

    void initializeLocalVault().then((result) => {
      if (!active) return

      if (result.status === 'error') {
        setMessage(result.message)
        setState('error')
        return
      }

      setState(result.access)
    })

    return () => {
      active = false
    }
  }, [])

  async function verifyUnlockedVault(createdPassword: boolean): Promise<boolean> {
    const verification = await verifyLocalEncryption()

    if (verification.status === 'error') {
      lockLocalVault()
      setPassword('')
      setConfirmation('')
      setShowPassword(false)
      setState('locked')
      setMessage(
        createdPassword
          ? `La contraseña maestra se creó, pero ${verification.message.toLowerCase()}`
          : verification.message,
      )
      return false
    }

    setPassword('')
    setConfirmation('')
    setMessage('')
    setState('unlocked')
    return true
  }

  async function handleSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    if (password.normalize('NFC') !== confirmation.normalize('NFC')) {
      setMessage('Las dos contraseñas no coinciden.')
      return
    }

    setBusy(true)
    const result = await createMasterPassword(password)

    if (result.status === 'error') {
      setBusy(false)
      setMessage(result.message)
      return
    }

    await verifyUnlockedVault(true)
    setBusy(false)
  }

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setBusy(true)
    const result = await unlockLocalVault(password)

    if (result.status === 'error') {
      setBusy(false)
      setMessage(result.message)
      return
    }

    await verifyUnlockedVault(false)
    setBusy(false)
  }

  function handleLock() {
    lockLocalVault()
    setPassword('')
    setConfirmation('')
    setMessage('')
    setShowPassword(false)
    setState('locked')
  }

  if (state === 'checking') {
    return (
      <div className="vault-panel" aria-live="polite">
        <span className="status-dot status-dot--checking" aria-hidden="true" />
        <div>
          <strong>Comprobando bóveda local</strong>
          <p>OANIX está revisando el estado de seguridad de este dispositivo.</p>
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="vault-panel vault-panel--error" role="alert">
        <span className="status-dot status-dot--error" aria-hidden="true" />
        <div>
          <strong>No se pudo abrir la bóveda local</strong>
          <p>{message || 'El navegador no pudo preparar el almacenamiento local de OANIX.'}</p>
        </div>
      </div>
    )
  }

  if (state === 'unlocked') {
    return (
      <div className="vault-panel vault-panel--unlocked" aria-live="polite">
        <div className="vault-panel__status">
          <span className="status-dot status-dot--ready" aria-hidden="true" />
          <div>
            <strong>Bóveda desbloqueada</strong>
            <p>La clave está en memoria y OANIX verificó el almacenamiento cifrado antes de abrir la bóveda.</p>
          </div>
        </div>
        <button className="secondary-button" type="button" onClick={handleLock}>
          Bloquear bóveda
        </button>
      </div>
    )
  }

  const isSetup = state === 'setup'

  return (
    <div className="vault-access">
      <div className="vault-access__heading">
        <span className="status-dot status-dot--checking" aria-hidden="true" />
        <div>
          <strong>{isSetup ? 'Protege tu bóveda' : 'Desbloquear OANIX'}</strong>
          <p>
            {isSetup
              ? `Crea una contraseña maestra de al menos ${MASTER_PASSWORD_MIN_CHARACTERS} caracteres.`
              : 'Introduce tu contraseña maestra para abrir la bóveda de este dispositivo.'}
          </p>
        </div>
      </div>

      <form className="vault-form" onSubmit={isSetup ? handleSetup : handleUnlock}>
        <label className="field" htmlFor="master-password">
          <span>Contraseña maestra</span>
          <div className="password-input">
            <input
              id="master-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isSetup ? 'new-password' : 'current-password'}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              minLength={isSetup ? MASTER_PASSWORD_MIN_CHARACTERS : undefined}
              maxLength={256}
              required
              disabled={busy}
            />
            <button
              className="input-action"
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              disabled={busy}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </label>

        {isSetup && (
          <label className="field" htmlFor="master-password-confirmation">
            <span>Repite la contraseña</span>
            <input
              id="master-password-confirmation"
              type={showPassword ? 'text' : 'password'}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              minLength={MASTER_PASSWORD_MIN_CHARACTERS}
              maxLength={256}
              required
              disabled={busy}
            />
          </label>
        )}

        {message && <p className="form-message" role="alert">{message}</p>}

        <button className="primary-button" type="submit" disabled={busy}>
          {busy
            ? isSetup
              ? 'Protegiendo y comprobando…'
              : 'Desbloqueando y comprobando…'
            : isSetup
              ? 'Crear contraseña maestra'
              : 'Desbloquear bóveda'}
        </button>
      </form>

      {isSetup && (
        <p className="security-note">
          OANIX no guarda tu contraseña. En V1 no existe recuperación: si la olvidas, una bóveda cifrada no podrá abrirse.
        </p>
      )}
    </div>
  )
}
