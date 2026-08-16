import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import {
  createMasterPassword,
  initializeLocalVault,
  lockLocalVault,
  MASTER_PASSWORD_MIN_CHARACTERS,
  unlockLocalVault,
  verifyLocalEncryption,
} from '../security/vault/vaultService'
import { restoreEncryptedBackupFromFile } from '../features/backup/backupService'

type GateState = 'checking' | 'setup' | 'locked' | 'unlocked' | 'error'

interface VaultGateProps {
  renderUnlocked: (lockVault: () => void) => ReactNode
}

export function VaultGate({ renderUnlocked }: VaultGateProps) {
  const [state, setState] = useState<GateState>('checking')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [restoreBusy, setRestoreBusy] = useState(false)
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

  async function handleRestoreBackup(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0] ?? null
    input.value = ''
    if (!file || state !== 'setup' || restoreBusy) return

    setRestoreBusy(true)
    setMessage('')
    try {
      const result = await restoreEncryptedBackupFromFile(file)
      lockLocalVault()
      setPassword('')
      setConfirmation('')
      setShowPassword(false)
      setState('locked')
      setMessage(`Backup restaurado (${result.recordCount} registros cifrados). Ingresa la contraseña maestra original del backup.`)
    } catch (restoreError) {
      setMessage(restoreError instanceof Error ? restoreError.message : 'No se pudo restaurar el backup cifrado.')
    } finally {
      setRestoreBusy(false)
    }
  }

  if (state === 'unlocked') {
    return <>{renderUnlocked(handleLock)}</>
  }

  const isSetup = state === 'setup'

  let gateContent: ReactNode
  if (state === 'checking') {
    gateContent = (
      <div className="vault-state" aria-live="polite">
        <span className="vault-loader" aria-hidden="true" />
        <div>
          <strong>Preparando tu bóveda</strong>
          <p>Comprobando el almacenamiento cifrado de este dispositivo.</p>
        </div>
      </div>
    )
  } else if (state === 'error') {
    gateContent = (
      <div className="vault-state vault-state--error" role="alert">
        <span className="vault-state__icon" aria-hidden="true">!</span>
        <div>
          <strong>No se pudo abrir la bóveda local</strong>
          <p>{message || 'El navegador no pudo preparar el almacenamiento local de OANIX.'}</p>
        </div>
      </div>
    )
  } else {
    gateContent = (
      <div className="vault-access">
        <div className="vault-access__heading">
          <span className="vault-access__lock" aria-hidden="true">
            <span />
          </span>
          <div>
            <strong>{isSetup ? 'Crea tu llave maestra' : 'Bienvenido de vuelta'}</strong>
            <p>
              {isSetup
                ? `Protege tu bóveda con al menos ${MASTER_PASSWORD_MIN_CHARACTERS} caracteres.`
                : 'Introduce tu contraseña maestra para descifrar tus notas en este dispositivo.'}
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

          <button className="primary-button" type="submit" disabled={busy || restoreBusy}>
            <span>{busy ? 'Procesando…' : isSetup ? 'Crear bóveda segura' : 'Entrar a OANIX'}</span>
            {!busy && <span aria-hidden="true">→</span>}
          </button>
        </form>

        {isSetup && (
          <>
            <p className="security-note">
              OANIX no guarda tu contraseña. En V1 no existe recuperación si la olvidas.
            </p>
            <div className="vault-restore">
              <span>¿Ya tienes una bóveda de OANIX?</span>
              <label className={`vault-restore__button${restoreBusy ? ' vault-restore__button--busy' : ''}`}>
                <span aria-hidden="true">↥</span>
                <span>{restoreBusy ? 'Restaurando backup…' : 'Restaurar backup cifrado'}</span>
                <input type="file" accept=".oanixbackup,application/json,application/vnd.oanix.encrypted-backup+json" onChange={(event) => void handleRestoreBackup(event)} disabled={busy || restoreBusy} />
              </label>
              <small>Usarás la misma contraseña maestra con la que se creó esa copia.</small>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <main className="vault-shell">
      <div className="vault-atmosphere" aria-hidden="true">
        <span className="vault-glow vault-glow--one" />
        <span className="vault-glow vault-glow--two" />
        <span className="vault-glow vault-glow--three" />
      </div>

      <section className="vault-landing" aria-labelledby="oanix-title">
        <div className="vault-intro">
          <div className="vault-brandline">
            <div className="vault-logo" aria-hidden="true">O</div>
            <div>
              <strong>OANIX</strong>
              <span>Secure private notes</span>
            </div>
          </div>

          <div className="vault-copy">
            <p className="vault-kicker"><span aria-hidden="true" /> OFFLINE-FIRST · CIFRADO LOCAL</p>
            <h1 className="vault-title" id="oanix-title">
              Tu espacio privado, <em>siempre contigo.</em>
            </h1>
            <p className="vault-lead">
              Escribe, organiza y conserva lo importante en una bóveda diseñada para funcionar primero en tu dispositivo.
            </p>
          </div>

          <div className="vault-core" aria-hidden="true">
            <span className="vault-core__ring vault-core__ring--outer" />
            <span className="vault-core__ring vault-core__ring--middle" />
            <span className="vault-core__ring vault-core__ring--inner" />
            <span className="vault-core__scan" />
            <strong>O</strong>
            <i className="vault-core__node vault-core__node--one" />
            <i className="vault-core__node vault-core__node--two" />
            <i className="vault-core__node vault-core__node--three" />
          </div>

          <div className="vault-assurances" aria-label="Características de privacidad">
            <div><span className="vault-assurance__mark" aria-hidden="true" /><strong>Local</strong><small>Tus datos viven primero aquí</small></div>
            <div><span className="vault-assurance__mark" aria-hidden="true" /><strong>Cifrado</strong><small>Contenido protegido en reposo</small></div>
            <div><span className="vault-assurance__mark" aria-hidden="true" /><strong>Offline</strong><small>Disponible sin depender de la nube</small></div>
          </div>
        </div>

        <div className="vault-card">
          <header className="vault-card__header">
            <div>
              <span className="vault-card__pulse" aria-hidden="true" />
              <strong>Bóveda local</strong>
            </div>
            <span className="vault-card__version">V1</span>
          </header>

          <div className="vault-card__body">{gateContent}</div>

          <footer className="vault-card__footer">
            <span><i aria-hidden="true" /> Privacidad por diseño</span>
            <span>OANIX</span>
          </footer>
        </div>
      </section>
    </main>
  )
}
