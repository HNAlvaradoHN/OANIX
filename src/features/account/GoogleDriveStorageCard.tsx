import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  connectGoogleDriveAndInspect,
  disconnectGoogleDriveSession,
  getGoogleDriveConnectionAvailability,
  hasActiveGoogleDriveConnection,
  inspectActiveGoogleDriveConnection,
  type GoogleDriveConnectionAvailability,
} from '../largeObjects/googleDriveConnectionService.ts'
import type { LargeObjectStorageCapacity } from '../largeObjects/largeObjectTransferContract.ts'
import { GoogleDriveControlledTransferPanel } from './GoogleDriveControlledTransferPanel.tsx'
import './googleDriveStorageCard.css'

function formatBytes(value: number | null): string {
  if (value === null) return 'Sin límite informado'
  if (!Number.isFinite(value) || value < 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let amount = value
  let unitIndex = 0
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024
    unitIndex += 1
  }
  const digits = amount >= 100 ? 0 : amount >= 10 ? 1 : 2
  return `${amount.toFixed(digits)} ${units[unitIndex]}`
}

function availabilityLabel(availability: GoogleDriveConnectionAvailability): string {
  if (availability === 'web-unconfigured') return 'No configurado en esta PWA'
  if (availability === 'android-ready') return 'Disponible en Android'
  return 'Disponible en esta PWA'
}

function GoogleDriveStorageHelp({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return createPortal(
    <div
      className="account-storage-help-overlay"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="account-storage-help"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-storage-help-title"
      >
        <header className="account-storage-help__header">
          <div>
            <span>ALMACENAMIENTO EN NUBE</span>
            <h3 id="account-storage-help-title">¿Para qué conectar Google Drive?</h3>
          </div>
          <button
            type="button"
            className="account-storage-help__close"
            onClick={onClose}
            data-oanix-back-close="true"
            aria-label="Cerrar ayuda de Google Drive"
          >
            ×
          </button>
        </header>

        <p className="account-storage-help__intro">
          OANIX puede utilizar el espacio disponible de tu Google Drive para guardar archivos grandes de forma cifrada, reduciendo el espacio que necesitan ocupar permanentemente en tu dispositivo.
        </p>
        <p className="account-storage-help__intro">
          Los archivos se cifran antes de salir del dispositivo y OANIX utiliza únicamente el espacio privado autorizado para la aplicación.
        </p>

        <div className="account-storage-help__benefits">
          <strong>Beneficios</strong>
          <ul>
            <li>Guardar archivos grandes.</li>
            <li>Aprovechar el almacenamiento que ya tienes en tu cuenta de Google.</li>
            <li>Reanudar transferencias si se interrumpe Internet.</li>
            <li>Reducir el uso del almacenamiento interno del dispositivo.</li>
            <li>Acceder en el futuro desde otros dispositivos autorizados.</li>
          </ul>
        </div>

        <div className="account-storage-help__facts">
          <p><strong>Opcional.</strong> OANIX debe seguir funcionando sin Google Drive.</p>
          <p><strong>Tu almacenamiento.</strong> El espacio utilizado pertenece a tu cuenta de Google.</p>
          <p><strong>Sin dependencia exclusiva.</strong> Google Drive es solo el primer proveedor de almacenamiento compatible.</p>
          <p><strong>Cifrado primero.</strong> Los archivos deben cifrarse antes de salir del dispositivo.</p>
        </div>
      </section>
    </div>,
    document.body,
  )
}

export function GoogleDriveStorageCard() {
  const availability = getGoogleDriveConnectionAvailability()
  const [connected, setConnected] = useState(hasActiveGoogleDriveConnection())
  const [capacity, setCapacity] = useState<LargeObjectStorageCapacity | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const usagePercent = useMemo(() => {
    if (!capacity || capacity.limitBytes === null || capacity.limitBytes <= 0) return null
    return Math.min(100, Math.max(0, (capacity.usageBytes / capacity.limitBytes) * 100))
  }, [capacity])

  async function connect() {
    setBusy(true)
    setMessage('')
    try {
      const snapshot = await connectGoogleDriveAndInspect()
      setConnected(snapshot.connected)
      setCapacity(snapshot.capacity)
      if (!snapshot.connected) setMessage('Conexión cancelada.')
    } catch (error) {
      setConnected(false)
      setCapacity(null)
      setMessage(error instanceof Error ? error.message : 'No se pudo conectar Google Drive.')
    } finally {
      setBusy(false)
    }
  }

  async function refreshCapacity() {
    setBusy(true)
    setMessage('')
    try {
      const nextCapacity = await inspectActiveGoogleDriveConnection()
      setCapacity(nextCapacity)
      setConnected(true)
    } catch (error) {
      setCapacity(null)
      setConnected(hasActiveGoogleDriveConnection())
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar el almacenamiento.')
    } finally {
      setBusy(false)
    }
  }

  function disconnect() {
    disconnectGoogleDriveSession()
    setConnected(false)
    setCapacity(null)
    setMessage('Google Drive se desconectó de esta sesión de OANIX.')
  }

  const disabled = busy || availability === 'web-unconfigured'

  return (
    <>
      <section className="account-storage-card" aria-labelledby="account-storage-title">
        <div className="account-storage-card__header">
          <div className="account-storage-card__icon" aria-hidden="true">☁</div>
          <div className="account-storage-card__heading">
            <div className="account-storage-card__title-row">
              <strong id="account-storage-title">Google Drive</strong>
              <button
                type="button"
                className="account-storage-card__help-button"
                onClick={() => setHelpOpen(true)}
                aria-label="¿Para qué conectar Google Drive?"
                title="¿Para qué conectar Google Drive?"
              >
                ?
              </button>
            </div>
            <span>{connected ? 'Conectado de forma temporal' : availabilityLabel(availability)}</span>
          </div>
          <span className={`account-storage-card__badge${connected ? ' account-storage-card__badge--active' : ''}`}>
            {connected ? 'Activo' : 'Opcional'}
          </span>
        </div>

        {capacity && (
          <div className="account-storage-card__capacity" aria-live="polite">
            <div className="account-storage-card__numbers">
              <span><strong>{formatBytes(capacity.usageBytes)}</strong> usados</span>
              <span>{capacity.availableBytes === null ? 'Disponible sin límite informado' : `${formatBytes(capacity.availableBytes)} disponibles`}</span>
            </div>
            {usagePercent !== null && (
              <div
                className="account-storage-card__bar"
                role="progressbar"
                aria-label="Uso de Google Drive"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(usagePercent)}
              >
                <span style={{ width: `${usagePercent}%` }} />
              </div>
            )}
            {capacity.limitBytes !== null && (
              <small>{formatBytes(capacity.usageBytes)} de {formatBytes(capacity.limitBytes)}</small>
            )}
          </div>
        )}

        {message && <p className="account-storage-card__message" role="status">{message}</p>}

        <div className="account-storage-card__actions">
          {!connected ? (
            <button type="button" onClick={() => void connect()} disabled={disabled}>
              {busy ? 'Conectando…' : 'Conectar Drive'}
            </button>
          ) : (
            <>
              <button type="button" onClick={() => void refreshCapacity()} disabled={busy}>
                {busy ? 'Actualizando…' : 'Actualizar espacio'}
              </button>
              <button type="button" className="account-storage-card__disconnect" onClick={disconnect} disabled={busy}>
                Desconectar
              </button>
            </>
          )}
        </div>

        {connected && (
          <GoogleDriveControlledTransferPanel
            disabled={busy}
            onStored={() => refreshCapacity()}
          />
        )}

        <p className="account-storage-card__hint">
          OANIX solo solicita su espacio privado de aplicación. Las credenciales de Drive no se guardan en la bóveda ni en el navegador.
        </p>
      </section>

      {helpOpen && <GoogleDriveStorageHelp onClose={() => setHelpOpen(false)} />}
    </>
  )
}
