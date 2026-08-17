import { useRef, useState, type FormEvent } from 'react'
import { MASTER_PASSWORD_MIN_CHARACTERS } from '../../security/vault/vaultService'
import {
  completeEmailVaultRecovery,
  getEmailRecoveryStatus,
  requestEmailRecoveryCode,
  type EmailRecoveryResult,
} from './recoveryService'

interface EmailRecoveryPanelProps {
  email: string
  disabled?: boolean
  onRecovered: (result: EmailRecoveryResult) => void
}

type RecoveryStage = 'idle' | 'code-sent'

export function EmailRecoveryPanel({ email, disabled = false, onRecovered }: EmailRecoveryPanelProps) {
  const [stage, setStage] = useState<RecoveryStage>('idle')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const startInFlight = useRef(false)

  async function handleStartRecovery() {
    if (busy || disabled || startInFlight.current) return
    startInFlight.current = true
    setBusy(true)
    setMessage('')

    try {
      const status = await getEmailRecoveryStatus()
      if (!status.prepared) {
        setMessage('Esta bóveda todavía no tiene recuperación por correo preparada. Entra una vez con tu contraseña maestra para que OANIX la active automáticamente.')
        return
      }

      const delivery = await requestEmailRecoveryCode(email)
      setStage('code-sent')
      setMessage(
        delivery === 'uncertain'
          ? `OANIX no pudo confirmar la respuesta de red, pero el código puede haberse enviado a ${email}. Revisa tu correo; si no llega, usa “Enviar otro código”.`
          : `Código enviado a ${email}. Escríbelo abajo y crea tu nueva contraseña maestra.`,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo iniciar la recuperación por correo.')
    } finally {
      startInFlight.current = false
      setBusy(false)
    }
  }

  async function handleRecover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || disabled) return

    if (newPassword.normalize('NFC') !== confirmation.normalize('NFC')) {
      setMessage('Las dos contraseñas nuevas no coinciden.')
      return
    }

    setBusy(true)
    setMessage('')
    try {
      const result = await completeEmailVaultRecovery(email, code, newPassword)
      setCode('')
      setNewPassword('')
      setConfirmation('')
      setStage('idle')
      onRecovered(result)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo recuperar la bóveda.')
    } finally {
      setBusy(false)
    }
  }

  if (stage === 'idle') {
    return (
      <div className="vault-restore">
        <span>¿Olvidaste la contraseña maestra?</span>
        <button
          type="button"
          className="vault-restore__button"
          onClick={() => void handleStartRecovery()}
          disabled={busy || disabled}
        >
          <span aria-hidden="true">✉</span>
          <span>{busy ? 'Preparando recuperación…' : 'Recuperar por correo'}</span>
        </button>
        {message && <small className="form-message" role="alert">{message}</small>}
      </div>
    )
  }

  return (
    <div className="vault-restore">
      <span>Recuperación por correo</span>
      <form className="vault-form" onSubmit={(event) => void handleRecover(event)}>
        <small>{message || `Código enviado a ${email}`}</small>

        <label className="field" htmlFor="vault-recovery-code">
          <span>Código del correo</span>
          <input
            id="vault-recovery-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
            minLength={6}
            maxLength={8}
            required
            disabled={busy || disabled}
          />
        </label>

        <label className="field" htmlFor="recovered-master-password">
          <span>Nueva contraseña maestra</span>
          <div className="password-input">
            <input
              id="recovered-master-password"
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              minLength={MASTER_PASSWORD_MIN_CHARACTERS}
              maxLength={256}
              required
              disabled={busy || disabled}
            />
            <button
              type="button"
              className="input-action"
              onClick={() => setShowPassword((visible) => !visible)}
              disabled={busy || disabled}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </label>

        <label className="field" htmlFor="recovered-master-password-confirmation">
          <span>Confirma la nueva contraseña</span>
          <input
            id="recovered-master-password-confirmation"
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
            disabled={busy || disabled}
          />
        </label>

        {message && message.startsWith('Código enviado') === false && message.startsWith('OANIX no pudo confirmar') === false && (
          <p className="form-message" role="alert">{message}</p>
        )}

        <button
          className="primary-button"
          type="submit"
          disabled={busy || disabled || code.length < 6 || !newPassword || !confirmation}
        >
          <span>{busy ? 'Recuperando bóveda…' : 'Verificar código y cambiar contraseña'}</span>
          {!busy && <span aria-hidden="true">→</span>}
        </button>

        <button
          type="button"
          className="vault-restore__button"
          onClick={() => void handleStartRecovery()}
          disabled={busy || disabled}
        >
          <span aria-hidden="true">↻</span>
          <span>Enviar otro código</span>
        </button>

        <button
          type="button"
          className="vault-restore__button"
          onClick={() => {
            setStage('idle')
            setCode('')
            setNewPassword('')
            setConfirmation('')
            setMessage('')
          }}
          disabled={busy || disabled}
        >
          <span aria-hidden="true">←</span>
          <span>Cancelar recuperación</span>
        </button>
      </form>
    </div>
  )
}
