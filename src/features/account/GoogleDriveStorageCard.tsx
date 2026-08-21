import { useMemo, useState } from 'react'
import {
  connectGoogleDriveAndInspect,
  disconnectGoogleDriveSession,
  getGoogleDriveConnectionAvailability,
  hasActiveGoogleDriveConnection,
  inspectActiveGoogleDriveConnection,
  type GoogleDriveConnectionAvailability,
} from '../largeObjects/googleDriveConnectionService.ts'
import type { LargeObjectStorageCapacity } from '../largeObjects/largeObjectTransferContract.ts'

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

export function GoogleDriveStorageCard() {
  const availability = getGoogleDriveConnectionAvailability()
  const [connected, setConnected] = useState(hasActiveGoogleDriveConnection())
  const [capacity, setCapacity] = useState<LargeObjectStorageCapacity | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

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
    <section className="account-storage-card" aria-labelledby="account-storage-title">
      <div className="account-storage-card__header">
        <div className="account-storage-card__icon" aria-hidden="true">☁</div>
        <div>
          <strong id="account-storage-title">Google Drive</strong>
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

      <p className="account-storage-card__hint">
        OANIX solo solicita su espacio privado de aplicación. Las credenciales de Drive no se guardan en la bóveda ni en el navegador.
      </p>
    </section>
  )
}
