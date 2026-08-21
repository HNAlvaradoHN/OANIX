import { useSyncExternalStore } from 'react'
import {
  clearLargeObjectTransferUi,
  getLargeObjectTransferUiSnapshot,
  subscribeLargeObjectTransferUi,
  type LargeObjectTransferUiPhase,
} from './largeObjectTransferUiStore.ts'
import './largeObjectTransferIndicator.css'

const PHASE_LABELS: Record<LargeObjectTransferUiPhase, string> = {
  preparing: 'Preparando',
  encrypting: 'Cifrando',
  uploading: 'Subiendo',
  verifying: 'Verificando',
  stored: 'Guardado ✓',
  paused: 'Pausado',
  failed: 'Error',
  resuming: 'Reanudando',
}

function formatBytes(value: number): string {
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

export function LargeObjectTransferIndicator() {
  const snapshot = useSyncExternalStore(
    subscribeLargeObjectTransferUi,
    getLargeObjectTransferUiSnapshot,
    () => null,
  )
  if (!snapshot) return null

  const phaseLabel = PHASE_LABELS[snapshot.phase]
  const isTerminal = snapshot.phase === 'stored' || snapshot.phase === 'failed'
  const detail = snapshot.phase === 'paused'
    ? `Pausado · ${snapshot.message || 'esperando conexión'}`
    : snapshot.phase === 'failed'
      ? snapshot.message || 'No se pudo completar la transferencia.'
      : `${snapshot.percent.toFixed(snapshot.percent >= 10 ? 0 : 1)}% · ${formatBytes(snapshot.processedBytes)} / ${formatBytes(snapshot.totalBytes)}`

  return (
    <aside className={`large-transfer${isTerminal ? ' large-transfer--terminal' : ''}`} aria-live="polite">
      <div className="large-transfer__topline">
        <div className="large-transfer__file">
          <strong title={snapshot.fileName}>{snapshot.fileName}</strong>
          <span>{phaseLabel}</span>
        </div>
        {isTerminal && (
          <button
            type="button"
            className="large-transfer__close"
            onClick={() => clearLargeObjectTransferUi(snapshot.objectId)}
            aria-label="Cerrar estado de transferencia"
          >
            ×
          </button>
        )}
      </div>

      <div
        className="large-transfer__bar"
        role="progressbar"
        aria-label={`Transferencia de ${snapshot.fileName}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(snapshot.percent)}
      >
        <span style={{ width: `${snapshot.percent}%` }} />
      </div>

      <div className="large-transfer__detail">
        <span>{detail}</span>
        {snapshot.mimeType && <small>{snapshot.mimeType}</small>}
      </div>
    </aside>
  )
}
