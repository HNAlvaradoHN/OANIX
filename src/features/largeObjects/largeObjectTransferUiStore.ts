import type { LargeObjectTransferProgress } from './largeObjectProtocol.ts'

export type LargeObjectTransferUiPhase = LargeObjectTransferProgress['phase'] | 'resuming'

export interface LargeObjectTransferUiMeta {
  objectId: string
  fileName: string
  mimeType?: string
}

export interface LargeObjectTransferUiSnapshot extends LargeObjectTransferUiMeta {
  phase: LargeObjectTransferUiPhase
  processedBytes: number
  totalBytes: number
  percent: number
  message: string | null
}

type Listener = () => void

let currentSnapshot: LargeObjectTransferUiSnapshot | null = null
const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) listener()
}

function setSnapshot(snapshot: LargeObjectTransferUiSnapshot | null): void {
  currentSnapshot = snapshot
  emit()
}

function requireMeta(meta: LargeObjectTransferUiMeta): LargeObjectTransferUiMeta {
  const objectId = meta.objectId.trim()
  const fileName = meta.fileName.trim()
  if (objectId.length < 8 || objectId.length > 120) throw new Error('El identificador de transferencia no es válido.')
  if (!fileName || fileName.length > 180) throw new Error('El nombre del archivo no es válido.')
  return { objectId, fileName, mimeType: meta.mimeType?.trim() || undefined }
}

export function getLargeObjectTransferUiSnapshot(): LargeObjectTransferUiSnapshot | null {
  return currentSnapshot
}

export function subscribeLargeObjectTransferUi(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function createLargeObjectTransferUiReporter(metaInput: LargeObjectTransferUiMeta) {
  const meta = requireMeta(metaInput)
  return (progress: LargeObjectTransferProgress): void => {
    setSnapshot({
      ...meta,
      phase: progress.phase,
      processedBytes: progress.processedBytes,
      totalBytes: progress.totalBytes,
      percent: progress.percent,
      message: null,
    })
  }
}

export function markLargeObjectTransferPaused(message = 'Esperando conexión'): void {
  if (!currentSnapshot || currentSnapshot.phase === 'stored') return
  setSnapshot({ ...currentSnapshot, phase: 'paused', message })
}

export function markLargeObjectTransferResuming(): void {
  if (!currentSnapshot || currentSnapshot.phase === 'stored') return
  setSnapshot({ ...currentSnapshot, phase: 'resuming', message: null })
}

export function markLargeObjectTransferFailed(error: unknown): void {
  if (!currentSnapshot || currentSnapshot.phase === 'stored') return
  setSnapshot({
    ...currentSnapshot,
    phase: 'failed',
    message: error instanceof Error ? error.message : 'No se pudo completar la transferencia.',
  })
}

export function clearLargeObjectTransferUi(objectId?: string): void {
  if (objectId && currentSnapshot?.objectId !== objectId) return
  setSnapshot(null)
}
