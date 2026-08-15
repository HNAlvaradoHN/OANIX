import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  createMasterPassword,
  initializeLocalVault,
  lockLocalVault,
  MASTER_PASSWORD_MIN_CHARACTERS,
  unlockLocalVault,
  verifyLocalEncryption,
} from '../security/vault/vaultService'

type GateState = 'checking' | 'setup' | 'locked' | 'unlocked' | 'error'

interface VaultGateProps {
  renderUnlocked: (lockVault: () => void) => ReactNode
}

const foundationItems = [
  'React + TypeScript',
  'PWA instalable',
  'Diseño adaptable',
  'Bóveda local',
  'Contraseña maestra',
  'Cifrado local',
  'Notas cifradas',
  'Validación automática',
]

export function VaultGate({ renderUnlocked }: VaultGateProps) {
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

  function handleLock() {
    lockLocalVault()
    setPassword('')
    setConfirmation('')
    setMessage('')
    setShowPassword(false)
    setState('locked')
  }

  async function verifyUnlockedVault(createdPassword: boolean): Promise<boolean> {
    const verification = await verifyLocalEncryption()

    if (verification.status === 'error') {
      handleLock()
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

  if (state === 'unlocked') {
    return <>{renderUnlocked(handleLock)}</>
  }

  let gateContent: ReactNode

  if (state === 'checking') {
    gateContent = (
      <div className="vault-panel" aria-live="polite">
        <span className="status-dot status-dot--checking" aria-hidden="true" />
        <div>
          <strong>Comprobando bóveda local</strong>
          <p>OANIX está revisando el estado de seguridad de este dispositivo.</p>
        </div>
      </div>
    )
  } else if (state === 'error') {
    gateContent = (
      <div className="vault-panel vault-panel--error" role="alert">
        <span className="status-dot status-dot--error" aria-hidden="true" />
        <div>
          <strong>No se pudo abrir la bóveda local</strong>
          <p>{message || 'El navegador no pudo preparar el almacenamiento local de OANIX.'}</p>
        </div>
      </div>
    )
  } else {
    const isSetup = state === 'setup'

    gateContent = (
      <div className="vault-access">
        <div className="vault-access__heading">
          <span className="status-dot status-dot--checking" aria-hidden="true" />
          <div>
            <strong>{isSetup ? 'Protege tu bóveda' : 'Desbloquear OANIX'}</strong>
            <p>
              {isSetup
                ? `Crea una contraseña maestra de al menos ${MASTER_PASSWORD_MIN_CHARACTERS} caracteres.`
                : 'Introduce tu contraseña maestra para abrir las notas cifradas de este dispositivo.'}
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

  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="oanix-title">
        <div className="brand-mark" aria-hidden="true">O</div>
        <p className="eyebrow">OANIX · V1</p>
        <h1 id="oanix-title">Tus notas. Tu dispositivo. Tu privacidad.</h1>
        <p className="hero-copy">
          OANIX guarda su núcleo en este dispositivo. Desbloquea la bóveda para entrar a tus notas cifradas.
        </p>

        {gateContent}

        <ul className="foundation-list" aria-label="Base técnica preparada">
          {foundationItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  )
}
