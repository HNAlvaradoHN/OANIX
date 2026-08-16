import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import {
  createMasterPassword,
  initializeLocalVault,
  lockLocalVault,
  MASTER_PASSWORD_MIN_CHARACTERS,
  unlockLocalVault,
  verifyLocalEncryption,
} from '../security/vault/vaultService'
import { restoreEncryptedBackupFromFile } from '../features/backup/backupService'
import { AccountPanel } from '../features/account/AccountPanel'
import {
  getOnlineAccountSession,
  type OnlineAccountSession,
} from '../features/account/accountService'
import {
  ensureRemoteVaultBootstrap,
  hasRemoteSyncedVault,
  restoreSyncedVaultToThisDevice,
} from '../features/sync/syncService'
import { syncEncryptedBinariesBidirectional } from '../features/sync/binarySyncService'

type GateState = 'checking' | 'setup' | 'locked' | 'unlocked' | 'error'
type AccessChoice = 'choose' | 'local' | 'synced'

interface VaultGateProps {
  renderUnlocked: (lockVault: () => void) => ReactNode
}

export function VaultGate({ renderUnlocked }: VaultGateProps) {
  const [state, setState] = useState<GateState>('checking')
  const [accessChoice, setAccessChoice] = useState<AccessChoice>('choose')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [restoreBusy, setRestoreBusy] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [restorePassword, setRestorePassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showRestorePassword, setShowRestorePassword] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [onlineSession, setOnlineSession] = useState<OnlineAccountSession | null>(null)
  const [remoteVaultAvailable, setRemoteVaultAvailable] = useState<boolean | null>(null)
  const [cloudPassword, setCloudPassword] = useState('')
  const [showCloudPassword, setShowCloudPassword] = useState(false)
  const [cloudBusy, setCloudBusy] = useState(false)
  const [cloudProgress, setCloudProgress] = useState('')

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

  useEffect(() => {
    if (state !== 'setup' && state !== 'locked') return
    let active = true

    void getOnlineAccountSession()
      .then(async (session) => {
        if (!active) return
        setOnlineSession(session)
        if (!session) {
          setRemoteVaultAvailable(null)
          return
        }
        const available = await hasRemoteSyncedVault()
        if (active) setRemoteVaultAvailable(available)
      })
      .catch(() => {
        if (active) setRemoteVaultAvailable(null)
      })

    return () => {
      active = false
    }
  }, [state])

  function resetRestoreDraft() {
    setRestoreFile(null)
    setRestorePassword('')
    setShowRestorePassword(false)
  }

  function resetCloudDraft() {
    setCloudPassword('')
    setShowCloudPassword(false)
    setCloudProgress('')
  }

  function chooseAccess(choice: AccessChoice) {
    setAccessChoice(choice)
    setMessage('')
    setPassword('')
    setConfirmation('')
    setShowPassword(false)
    resetCloudDraft()
  }

  function handleLock() {
    lockLocalVault()
    setPassword('')
    setConfirmation('')
    setMessage('')
    setShowPassword(false)
    resetRestoreDraft()
    resetCloudDraft()
    setAccessChoice('choose')
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

  function handleRestoreBackupSelection(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0] ?? null
    input.value = ''
    if (!file || restoreBusy || (state !== 'setup' && state !== 'locked')) return

    setMessage('')
    setRestoreFile(file)
    setRestorePassword('')
    setShowRestorePassword(false)
  }

  async function handleRestoreBackup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restoreFile || !restorePassword || restoreBusy || (state !== 'setup' && state !== 'locked')) return

    if (
      state === 'locked'
      && !window.confirm('La restauración reemplazará la bóveda local actual solo después de verificar por completo el backup. ¿Quieres continuar?')
    ) {
      return
    }

    setRestoreBusy(true)
    setMessage('')
    try {
      const result = await restoreEncryptedBackupFromFile(restoreFile, restorePassword)
      setPassword('')
      setConfirmation('')
      setShowPassword(false)
      resetRestoreDraft()
      setState('unlocked')
      window.alert(`Backup cifrado restaurado correctamente.\n\n${result.recordCount} registros verificados y restaurados.`)
    } catch (restoreError) {
      setMessage(restoreError instanceof Error ? restoreError.message : 'No se pudo restaurar el backup cifrado.')
    } finally {
      setRestoreBusy(false)
    }
  }

  const handleAccountSessionChange = useCallback(async (session: OnlineAccountSession | null) => {
    setOnlineSession(session)
    setCloudPassword('')
    setShowCloudPassword(false)
    setCloudProgress('')
    if (!session) {
      setRemoteVaultAvailable(null)
      return
    }

    try {
      setRemoteVaultAvailable(await hasRemoteSyncedVault())
    } catch (error) {
      setRemoteVaultAvailable(false)
      setMessage(error instanceof Error ? error.message : 'No se pudo comprobar la bóveda sincronizada.')
    }
  }, [])

  async function handleRestoreSyncedVault(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const canUseCloud = state === 'setup' || state === 'locked'
    if (!cloudPassword || cloudBusy || !canUseCloud || !onlineSession || remoteVaultAvailable !== true) return

    setCloudBusy(true)
    setCloudProgress('Comprobando esta bóveda…')
    setMessage('')

    try {
      if (state === 'locked') {
        const localUnlock = await unlockLocalVault(cloudPassword)
        if (localUnlock.status !== 'error') {
          const verification = await verifyLocalEncryption()
          if (verification.status === 'error') {
            lockLocalVault()
            setMessage(verification.message)
            return
          }

          try {
            await ensureRemoteVaultBootstrap()
            setPassword('')
            setConfirmation('')
            setShowPassword(false)
            resetCloudDraft()
            setState('unlocked')
            return
          } catch (linkError) {
            lockLocalVault()
            const linkMessage = linkError instanceof Error ? linkError.message : ''
            if (!linkMessage.includes('otra clave de bóveda')) {
              setMessage(linkMessage || 'No se pudo comprobar si esta es la bóveda vinculada a tu cuenta.')
              return
            }
          }
        }

        if (!window.confirm(
          'Este dispositivo tiene una bóveda local diferente. La bóveda sincronizada de tu cuenta la reemplazará solo después de verificarla por completo. Si quieres conservar la bóveda local actual, cancela y crea primero un backup cifrado. ¿Quieres continuar?',
        )) {
          return
        }
      }

      setCloudProgress('Verificando contraseña y registros cifrados…')
      const result = await restoreSyncedVaultToThisDevice(cloudPassword)

      setCloudProgress('Sincronizando imágenes cifradas…')
      let binaryWarning = ''
      try {
        const binaryResult = await syncEncryptedBinariesBidirectional()
        if (binaryResult.conflicts > 0) {
          binaryWarning = `${binaryResult.conflicts} imagen${binaryResult.conflicts === 1 ? '' : 'es'} requiere${binaryResult.conflicts === 1 ? '' : 'n'} revisión de conflicto.`
        }
      } catch (binaryError) {
        binaryWarning = binaryError instanceof Error
          ? binaryError.message
          : 'Las imágenes se reintentarán mediante la sincronización automática.'
      }

      setCloudProgress('Comprobando almacenamiento local…')
      const verification = await verifyLocalEncryption()
      if (verification.status === 'error') {
        lockLocalVault()
        setMessage(verification.message)
        return
      }

      setPassword('')
      setConfirmation('')
      setShowPassword(false)
      resetCloudDraft()
      setState('unlocked')

      if (binaryWarning) {
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('oanix:sync-status', {
            detail: { kind: 'conflict', message: binaryWarning, at: new Date().toISOString() },
          }))
        }, 0)
      }

      void result
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo abrir la bóveda sincronizada.')
    } finally {
      setCloudBusy(false)
      setCloudProgress('')
    }
  }

  if (state === 'unlocked') {
    return <>{renderUnlocked(handleLock)}</>
  }

  const isSetup = state === 'setup'
  const canRestore = state === 'setup' || state === 'locked'

  const accessChooser = (
    <>
      <div className="vault-access__heading">
        <span className="vault-access__lock" aria-hidden="true"><span /></span>
        <div>
          <strong>Elige cómo entrar</strong>
          <p>Tu cuenta sincronizada y el modo local siguen siendo independientes. Elige cuál quieres abrir en este dispositivo.</p>
        </div>
      </div>

      <div className="vault-restore">
        <span>Bóveda sincronizada</span>
        <button
          type="button"
          className="vault-restore__button"
          onClick={() => {
            chooseAccess('synced')
            if (!onlineSession) setAccountOpen(true)
          }}
          disabled={busy || restoreBusy || cloudBusy}
        >
          <span aria-hidden="true">G</span>
          <span>
            Bóveda sincronizada con Google
            {onlineSession?.email ? ` · ${onlineSession.email}` : ''}
          </span>
        </button>
      </div>

      <div className="vault-restore">
        <span>Sin cuenta</span>
        <button
          type="button"
          className="vault-restore__button"
          onClick={() => chooseAccess('local')}
          disabled={busy || restoreBusy || cloudBusy}
        >
          <span aria-hidden="true">⌂</span>
          <span>Modo local · usar solo esta bóveda del dispositivo</span>
        </button>
      </div>
    </>
  )

  const localAccess = (
    <>
      <div className="vault-access__heading">
        <span className="vault-access__lock" aria-hidden="true"><span /></span>
        <div>
          <strong>{isSetup ? 'Crear bóveda local' : 'Entrar en modo local'}</strong>
          <p>
            {isSetup
              ? `Protege esta bóveda local con al menos ${MASTER_PASSWORD_MIN_CHARACTERS} caracteres.`
              : 'Introduce la contraseña maestra de la bóveda guardada en este dispositivo.'}
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
              disabled={busy || restoreBusy || cloudBusy}
            />
            <button
              className="input-action"
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              disabled={busy || restoreBusy || cloudBusy}
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
              disabled={busy || restoreBusy || cloudBusy}
            />
          </label>
        )}

        {message && <p className="form-message" role="alert">{message}</p>}

        <button className="primary-button" type="submit" disabled={busy || restoreBusy || cloudBusy}>
          <span>{busy ? 'Procesando…' : isSetup ? 'Crear bóveda local segura' : 'Entrar a OANIX'}</span>
          {!busy && <span aria-hidden="true">→</span>}
        </button>
      </form>

      {isSetup && (
        <p className="security-note">
          OANIX no guarda tu contraseña maestra. El modo local funciona sin correo ni Google y permanece disponible offline.
        </p>
      )}

      <div className="vault-restore">
        <button type="button" className="vault-restore__button" onClick={() => chooseAccess('choose')}>
          <span aria-hidden="true">←</span>
          <span>Elegir otra forma de acceso</span>
        </button>
      </div>
    </>
  )

  const syncedAccess = (
    <>
      <div className="vault-access__heading">
        <span className="vault-access__lock" aria-hidden="true"><span /></span>
        <div>
          <strong>Bóveda sincronizada con Google</strong>
          <p>Usa la contraseña maestra de tu bóveda. Google identifica la cuenta, pero nunca recibe esta contraseña.</p>
        </div>
      </div>

      {!onlineSession ? (
        <div className="vault-restore">
          <span>Primero conecta tu cuenta</span>
          <button
            type="button"
            className="vault-restore__button"
            onClick={() => setAccountOpen(true)}
            disabled={busy || restoreBusy || cloudBusy}
          >
            <span aria-hidden="true">G</span>
            <span>Continuar con Google</span>
          </button>
        </div>
      ) : remoteVaultAvailable === true ? (
        <form className="vault-form" onSubmit={(event) => void handleRestoreSyncedVault(event)}>
          <small>Cuenta conectada: {onlineSession.email}</small>
          <label className="field" htmlFor="cloud-master-password">
            <span>Contraseña maestra de tu bóveda</span>
            <div className="password-input">
              <input
                id="cloud-master-password"
                type={showCloudPassword ? 'text' : 'password'}
                value={cloudPassword}
                onChange={(event) => setCloudPassword(event.target.value)}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={256}
                required
                disabled={busy || restoreBusy || cloudBusy}
              />
              <button
                className="input-action"
                type="button"
                onClick={() => setShowCloudPassword((visible) => !visible)}
                aria-label={showCloudPassword ? 'Ocultar contraseña de la bóveda' : 'Mostrar contraseña de la bóveda'}
                disabled={busy || restoreBusy || cloudBusy}
              >
                {showCloudPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </label>

          {message && <p className="form-message" role="alert">{message}</p>}

          <button className="primary-button" type="submit" disabled={busy || restoreBusy || cloudBusy || !cloudPassword}>
            <span>{cloudBusy ? (cloudProgress || 'Preparando acceso…') : 'Entrar con mi bóveda sincronizada'}</span>
            {!cloudBusy && <span aria-hidden="true">→</span>}
          </button>
          <small>Si esta ya es la misma bóveda del dispositivo, OANIX la abre directamente. Solo propone reemplazar cuando detecta otra bóveda local.</small>
        </form>
      ) : remoteVaultAvailable === false ? (
        <div className="vault-restore">
          <small>Esta cuenta todavía no tiene una bóveda sincronizada disponible.</small>
          <button type="button" className="vault-restore__button" onClick={() => setAccountOpen(true)}>
            <span aria-hidden="true">👤</span>
            <span>Cambiar o revisar cuenta</span>
          </button>
        </div>
      ) : (
        <div className="vault-state" aria-live="polite">
          <span className="vault-loader" aria-hidden="true" />
          <div><strong>Comprobando tu cuenta</strong><p>Buscando la bóveda sincronizada disponible.</p></div>
        </div>
      )}

      <div className="vault-restore">
        <button type="button" className="vault-restore__button" onClick={() => chooseAccess('choose')} disabled={cloudBusy}>
          <span aria-hidden="true">←</span>
          <span>Elegir otra forma de acceso</span>
        </button>
      </div>
    </>
  )

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
        {accessChoice === 'choose' ? accessChooser : accessChoice === 'local' ? localAccess : syncedAccess}

        {canRestore && accessChoice === 'local' && (
          <div className="vault-restore">
            <span>{isSetup ? '¿Prefieres usar un archivo de backup?' : '¿Necesitas recuperar una copia anterior?'}</span>
            <label className={`vault-restore__button${restoreBusy ? ' vault-restore__button--busy' : ''}`}>
              <span aria-hidden="true">↥</span>
              <span>{restoreFile ? 'Cambiar archivo de backup' : 'Seleccionar backup cifrado'}</span>
              <input
                type="file"
                accept=".oanixbackup,application/json,application/vnd.oanix.encrypted-backup+json"
                onChange={handleRestoreBackupSelection}
                disabled={busy || restoreBusy || cloudBusy}
              />
            </label>

            {restoreFile ? (
              <form className="vault-form" onSubmit={(event) => void handleRestoreBackup(event)}>
                <small>Archivo seleccionado: {restoreFile.name}</small>
                <label className="field" htmlFor="backup-master-password">
                  <span>Contraseña maestra del backup</span>
                  <div className="password-input">
                    <input
                      id="backup-master-password"
                      type={showRestorePassword ? 'text' : 'password'}
                      value={restorePassword}
                      onChange={(event) => setRestorePassword(event.target.value)}
                      autoComplete="current-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      maxLength={256}
                      required
                      disabled={busy || restoreBusy || cloudBusy}
                    />
                    <button
                      className="input-action"
                      type="button"
                      onClick={() => setShowRestorePassword((visible) => !visible)}
                      aria-label={showRestorePassword ? 'Ocultar contraseña del backup' : 'Mostrar contraseña del backup'}
                      disabled={busy || restoreBusy || cloudBusy}
                    >
                      {showRestorePassword ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                </label>
                <button className="primary-button" type="submit" disabled={busy || restoreBusy || cloudBusy || !restorePassword}>
                  <span>{restoreBusy ? 'Verificando backup…' : state === 'locked' ? 'Verificar y reemplazar bóveda' : 'Verificar y restaurar'}</span>
                  {!restoreBusy && <span aria-hidden="true">→</span>}
                </button>
                <small>
                  {state === 'locked'
                    ? 'La bóveda actual no se modifica hasta que contraseña y registros del backup hayan sido verificados.'
                    : 'OANIX verificará la contraseña y todos los registros antes de restaurarlos.'}
                </small>
              </form>
            ) : (
              <small>El archivo se procesa en memoria y no se guarda otra copia dentro de OANIX.</small>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
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
                <strong>Acceso seguro</strong>
              </div>
              <span className="vault-card__version">V2</span>
            </header>

            <div className="vault-card__body">{gateContent}</div>

            <footer className="vault-card__footer">
              <span><i aria-hidden="true" /> Privacidad por diseño</span>
              <span>OANIX</span>
            </footer>
          </div>
        </section>
      </main>

      {accountOpen && (
        <AccountPanel
          context="vault-setup"
          onClose={() => setAccountOpen(false)}
          onSessionChange={handleAccountSessionChange}
        />
      )}
    </>
  )
}
