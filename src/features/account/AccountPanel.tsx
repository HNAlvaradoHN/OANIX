import { useState, type FormEvent } from 'react'
import { ACCOUNT_PASSWORD_MIN_CHARACTERS, createOnlineAccount } from './accountService'
import './account.css'

interface AccountPanelProps {
  onClose: () => void
}

export function AccountPanel({ onClose }: AccountPanelProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setSuccess(false)

    if (password !== confirmation) {
      setMessage('Las contraseñas de la cuenta no coinciden.')
      return
    }

    setBusy(true)
    try {
      const result = await createOnlineAccount(email, password)
      setSuccess(true)
      setPassword('')
      setConfirmation('')
      setMessage(
        result.requiresEmailConfirmation
          ? `Cuenta creada para ${result.email}. Revisa tu correo para confirmarla.`
          : `Cuenta creada correctamente para ${result.email}.`,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear la cuenta de OANIX.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="account-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="account-panel" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <header className="account-panel__header">
          <div>
            <span className="account-panel__eyebrow">OANIX · V2</span>
            <h2 id="account-title">Cuenta de usuario</h2>
          </div>
          <button type="button" className="account-panel__close" onClick={onClose} aria-label="Cerrar cuenta">×</button>
        </header>

        <div className="account-panel__notice">
          <strong>Tu bóveda local no cambia.</strong>
          <p>Esta cuenta será para sincronización futura. La contraseña de la cuenta es independiente de tu contraseña maestra de OANIX.</p>
        </div>

        <form className="account-form" onSubmit={(event) => void handleSubmit(event)}>
          <label>
            <span>Correo electrónico</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              disabled={busy}
            />
          </label>

          <label>
            <span>Contraseña de la cuenta</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={ACCOUNT_PASSWORD_MIN_CHARACTERS}
              maxLength={256}
              required
              disabled={busy}
            />
            <small>Mínimo {ACCOUNT_PASSWORD_MIN_CHARACTERS} caracteres. No tiene que ser igual a la contraseña maestra.</small>
          </label>

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
              disabled={busy}
            />
          </label>

          {message && (
            <p className={`account-form__message${success ? ' account-form__message--success' : ''}`} role={success ? 'status' : 'alert'}>
              {message}
            </p>
          )}

          <button type="submit" className="account-form__submit" disabled={busy || success}>
            {busy ? 'Creando cuenta…' : success ? 'Cuenta creada' : 'Crear cuenta online'}
          </button>
        </form>

        <footer className="account-panel__footer">
          <span>Sincronización todavía desactivada</span>
          <span>V2 · Paso 1</span>
        </footer>
      </section>
    </div>
  )
}
