import { useEffect, useState, type FormEvent } from 'react'
import {
  ACCOUNT_PASSWORD_MIN_CHARACTERS,
  continueWithGoogle,
  createOnlineAccount,
  getOnlineAccountSession,
  signInOnlineAccount,
  signOutOnlineAccount,
  subscribeOnlineAccountSession,
  type OnlineAccountSession,
} from './accountService'
import './account.css'

interface AccountPanelProps {
  onClose: () => void
  context?: 'workspace' | 'vault-setup'
  onSessionChange?: (session: OnlineAccountSession | null) => void
}

type AccountView = 'signin' | 'signup'
type BusyAction = 'email' | 'google' | 'signout' | null

interface SyncStatusEventDetail {
  message?: string
}

export function AccountPanel({
  onClose,
  context = 'workspace',
  onSessionChange,
}: AccountPanelProps) {
  const [view, setView] = useState<AccountView>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busyAction, setBusyAction] = useState<BusyAction>(null)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const [session, setSession] = useState<OnlineAccountSession | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [syncStatus, setSyncStatus] = useState('Sincronización automática preparada.')

  useEffect(() => {
    let active = true
    const applySession = (nextSession: OnlineAccountSession | null) => {
      if (!active) return
      setSession(nextSession)
      onSessionChange?.(nextSession)
      setLoadingSession(false)
      if (nextSession) {
        setMessage('')
        setPassword('')
        setConfirmation('')
      }
    }

    const unsubscribe = subscribeOnlineAccountSession(applySession)

    void getOnlineAccountSession()
      .then(applySession)
      .catch((error) => {
        if (!active) return
        setMessage(error instanceof Error ? error.message : 'No se pudo comprobar la sesión online.')
      })
      .finally(() => {
        if (active) setLoadingSession(false)
      })

    return () => {
      active = false
      unsubscribe()
    }
  }, [onSessionChange])

  useEffect(() => {
    if (context !== 'workspace') return
    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent<SyncStatusEventDetail>).detail
      if (detail?.message) setSyncStatus(detail.message)
    }
    window.addEventListener('oanix:sync-status', handleStatus)
    return () => window.removeEventListener('oanix:sync-status', handleStatus)
  }, [context])

  function changeView(nextView: AccountView) {
    setView(nextView)
    setMessage('')
    setSuccess(false)
    setPassword('')
    setConfirmation('')
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setSuccess(false)

    if (view === 'signup' && password !== confirmation) {
      setMessage('Las contraseñas de la cuenta no coinciden.')
      return
    }

    setBusyAction('email')
    try {
      if (view === 'signup') {
        const result = await createOnlineAccount(email, password)
        setSuccess(true)
        setPassword('')
        setConfirmation('')
        setMessage(
          result.requiresEmailConfirmation
            ? `Cuenta creada para ${result.email}. Revisa tu correo para confirmarla.`
            : `Cuenta creada correctamente para ${result.email}.`,
        )
      } else {
        const nextSession = await signInOnlineAccount(email, password)
        setSession(nextSession)
        onSessionChange?.(nextSession)
        setSuccess(true)
        setMessage('Sesión iniciada correctamente.')
        setPassword('')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo completar la autenticación de OANIX.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleGoogle() {
    setMessage('')
    setSuccess(false)
    setBusyAction('google')
    try {
      const nextSession = await continueWithGoogle()
      setSession(nextSession)
      onSessionChange?.(nextSession)
      setSuccess(true)
      setMessage(
        context === 'workspace'
          ? 'Sesión iniciada con Google. La bóveda permaneció abierta.'
          : 'Cuenta conectada. Ahora puedes traer tu bóveda cifrada de otro dispositivo.',
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo iniciar con Google.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleSignOut() {
    setMessage('')
    setSuccess(false)
    setBusyAction('signout')
    try {
      await signOutOnlineAccount()
      setSession(null)
      onSessionChange?.(null)
      setMessage('Sesión online cerrada. OANIX continúa en modo local.')
      setSuccess(true)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo cerrar la sesión online.')
    } finally {
      setBusyAction(null)
    }
  }

  const isBusy = busyAction !== null
  const hasGoogle = session?.providers.includes('google') ?? false
  const hasEmail = session?.providers.includes('email') ?? false

  return (
    <div className="account-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="account-panel" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <header className="account-panel__header">
          <div>
            <span className="account-panel__eyebrow">OANIX · V2</span>
            <h2 id="account-title">Cuenta y acceso</h2>
          </div>
          <button type="button" className="account-panel__close" onClick={onClose} aria-label="Cerrar cuenta">×</button>
        </header>

        <div className="account-panel__notice">
          <strong>Modo local siempre disponible.</strong>
          <p>Las notas funcionan sin correo ni Google. La cuenta online es opcional y permanece separada de tu contraseña maestra de OANIX.</p>
        </div>

        {loadingSession ? (
          <div className="account-session-loading" role="status">Comprobando sesión…</div>
        ) : session ? (
          <div className="account-session">
            <div className="account-session__status">
              <span className="account-session__dot" aria-hidden="true" />
              <div>
                <strong>Cuenta conectada</strong>
                <span>{session.email}</span>
              </div>
            </div>

            <div className="account-identities" aria-label="Métodos vinculados">
              <span className={hasGoogle ? 'account-identity account-identity--active' : 'account-identity'}>
                Google {hasGoogle ? '✓' : '—'}
              </span>
              <span className={hasEmail ? 'account-identity account-identity--active' : 'account-identity'}>
                Correo {hasEmail ? '✓' : '—'}
              </span>
            </div>

            <p className="account-session__privacy">
              {context === 'workspace'
                ? 'La contraseña maestra nunca se envía. Los registros compatibles se guardan localmente y OANIX sincroniza automáticamente sobres E2EE con Supabase cuando hay conexión. Si llega un cambio remoto, se aplica sin cerrar la bóveda.'
                : 'Esta cuenta solo identifica qué bóveda cifrada te pertenece. Para abrirla en este dispositivo todavía necesitarás la misma contraseña maestra; Supabase no la recibe.'}
            </p>

            {context === 'workspace' && (
              <div className="account-panel__notice" role="status" aria-live="polite">
                <strong>☁ Sincronización automática</strong>
                <p>{syncStatus}</p>
                <p>Las imágenes/binarios continúan pendientes dentro del bloque Varios dispositivos; texto, carpetas, etiquetas y demás registros no binarios ya usan autosync E2EE.</p>
              </div>
            )}

            {message && (
              <p className={`account-form__message${success ? ' account-form__message--success' : ''}`} role={success ? 'status' : 'alert'}>
                {message}
              </p>
            )}

            {context === 'vault-setup' && (
              <button type="button" className="account-form__submit" onClick={onClose} disabled={isBusy}>
                Continuar con esta cuenta
              </button>
            )}
            <button type="button" className="account-secondary-action" onClick={() => void handleSignOut()} disabled={isBusy}>
              {busyAction === 'signout' ? 'Cerrando sesión…' : 'Cerrar sesión online'}
            </button>
            {context === 'workspace' && (
              <button type="button" className="account-local-action" onClick={onClose} disabled={isBusy}>
                Volver a mis notas
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="account-auth-options">
              <button type="button" className="account-google-action" onClick={() => void handleGoogle()} disabled={isBusy}>
                <span className="account-google-action__mark" aria-hidden="true">G</span>
                {busyAction === 'google' ? 'Esperando Google…' : 'Continuar con Google'}
              </button>

              <div className="account-divider"><span>o</span></div>

              <div className="account-view-switch" role="tablist" aria-label="Acceso por correo">
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'signin'}
                  className={view === 'signin' ? 'account-view-switch__active' : ''}
                  onClick={() => changeView('signin')}
                  disabled={isBusy}
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'signup'}
                  className={view === 'signup' ? 'account-view-switch__active' : ''}
                  onClick={() => changeView('signup')}
                  disabled={isBusy}
                >
                  Crear cuenta
                </button>
              </div>
            </div>

            <form className="account-form" onSubmit={(event) => void handleEmailSubmit(event)}>
              <label>
                <span>Correo electrónico</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  disabled={isBusy}
                />
              </label>

              <label>
                <span>Contraseña de la cuenta</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
                  minLength={view === 'signup' ? ACCOUNT_PASSWORD_MIN_CHARACTERS : undefined}
                  maxLength={256}
                  required
                  disabled={isBusy}
                />
                {view === 'signup' && (
                  <small>Mínimo {ACCOUNT_PASSWORD_MIN_CHARACTERS} caracteres. No tiene que ser igual a la contraseña maestra.</small>
                )}
              </label>

              {view === 'signup' && (
                <label>
                  <span>Repite la contraseña</span>
                  <input
                    type="password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    autoComplete="new-password"
                    minLength={ACCOUNT_PASSWORD_MIN_CHARACTERS}
                    maxLength={256}
                    required
                    disabled={isBusy}
                  />
                </label>
              )}

              {message && (
                <p className={`account-form__message${success ? ' account-form__message--success' : ''}`} role={success ? 'status' : 'alert'}>
                  {message}
                </p>
              )}

              <button type="submit" className="account-form__submit" disabled={isBusy || (view === 'signup' && success)}>
                {busyAction === 'email'
                  ? (view === 'signup' ? 'Creando cuenta…' : 'Iniciando sesión…')
                  : (view === 'signup' ? (success ? 'Cuenta creada' : 'Crear cuenta online') : 'Iniciar sesión')}
              </button>
            </form>

            {context === 'workspace' && (
              <div className="account-local-zone">
                <span>¿Prefieres no compartir correo?</span>
                <button type="button" className="account-local-action" onClick={onClose} disabled={isBusy}>
                  Seguir en modo local
                </button>
              </div>
            )}
          </>
        )}

        <footer className="account-panel__footer">
          <span>{context === 'workspace' ? 'Autosync E2EE activo · binarios pendientes' : 'Acceso a bóveda sincronizada'}</span>
          <span>V2 · Varios dispositivos</span>
        </footer>
      </section>
    </div>
  )
}
