export const LARGE_OBJECT_PROTOCOL = 'oanix-large-object-v1' as const
export const LARGE_OBJECT_ENCRYPTION_SCHEME = 'aes-gcm-chunk-v1' as const

// 8 MiB keeps memory bounded while remaining a multiple of 256 KiB,
// which is friendly to resumable cloud upload protocols.
export const DEFAULT_LARGE_OBJECT_CHUNK_BYTES = 8 * 1024 * 1024
export const MIN_LARGE_OBJECT_CHUNK_BYTES = 1024 * 1024
export const MAX_LARGE_OBJECT_CHUNK_BYTES = 64 * 1024 * 1024
export const LARGE_OBJECT_CHUNK_ALIGNMENT_BYTES = 256 * 1024

// Initial safety ceiling. It is intentionally above the 5 GB target while
// keeping manifests and local bookkeeping reasonably small for v1.
export const MAX_LARGE_OBJECT_BYTES = 20 * 1024 * 1024 * 1024

export type LargeObjectTransferPhase =
  | 'preparing'
  | 'encrypting'
  | 'uploading'
  | 'verifying'
  | 'stored'
  | 'paused'
  | 'failed'

export interface LargeObjectChunkPlan {
  index: number
  plaintextOffset: number
  plaintextLength: number
}

export interface LargeObjectChunkManifest extends LargeObjectChunkPlan {
  ciphertextByteLength: number
  iv: string
  sha256: string
}

export interface LargeObjectManifestV1 {
  protocol: typeof LARGE_OBJECT_PROTOCOL
  encryption: typeof LARGE_OBJECT_ENCRYPTION_SCHEME
  objectId: string
  fileName: string
  mimeType: string
  plaintextByteLength: number
  chunkBytes: number
  chunkCount: number
  createdAt: string
  chunks: LargeObjectChunkManifest[]
}

export interface LargeObjectTransferProgress {
  phase: LargeObjectTransferPhase
  processedBytes: number
  totalBytes: number
  percent: number
}

function requireSafePositiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} debe ser un entero positivo seguro.`)
  }
  return value
}

export function validateLargeObjectChunkBytes(value: number): number {
  requireSafePositiveInteger(value, 'El tamaño de fragmento')
  if (value < MIN_LARGE_OBJECT_CHUNK_BYTES || value > MAX_LARGE_OBJECT_CHUNK_BYTES) {
    throw new Error('El tamaño de fragmento está fuera del rango seguro de OANIX.')
  }
  if (value % LARGE_OBJECT_CHUNK_ALIGNMENT_BYTES !== 0) {
    throw new Error('El tamaño de fragmento debe ser múltiplo de 256 KiB.')
  }
  return value
}

export function validateLargeObjectByteLength(value: number): number {
  requireSafePositiveInteger(value, 'El tamaño del archivo')
  if (value > MAX_LARGE_OBJECT_BYTES) {
    throw new Error('El archivo supera el límite de seguridad inicial para archivos grandes de OANIX.')
  }
  return value
}

export function planLargeObjectChunks(
  plaintextByteLength: number,
  chunkBytes = DEFAULT_LARGE_OBJECT_CHUNK_BYTES,
): LargeObjectChunkPlan[] {
  const totalBytes = validateLargeObjectByteLength(plaintextByteLength)
  const safeChunkBytes = validateLargeObjectChunkBytes(chunkBytes)
  const chunkCount = Math.ceil(totalBytes / safeChunkBytes)
  const chunks = new Array<LargeObjectChunkPlan>(chunkCount)

  for (let index = 0; index < chunkCount; index += 1) {
    const plaintextOffset = index * safeChunkBytes
    chunks[index] = {
      index,
      plaintextOffset,
      plaintextLength: Math.min(safeChunkBytes, totalBytes - plaintextOffset),
    }
  }

  return chunks
}

export function createLargeObjectTransferProgress(
  phase: LargeObjectTransferPhase,
  processedBytes: number,
  totalBytes: number,
): LargeObjectTransferProgress {
  const safeTotal = validateLargeObjectByteLength(totalBytes)
  if (!Number.isSafeInteger(processedBytes) || processedBytes < 0) {
    throw new Error('El progreso transferido debe ser un entero seguro mayor o igual a cero.')
  }
  const boundedProcessed = Math.min(processedBytes, safeTotal)
  return {
    phase,
    processedBytes: boundedProcessed,
    totalBytes: safeTotal,
    percent: phase === 'stored'
      ? 100
      : Math.min(99.99, Number(((boundedProcessed / safeTotal) * 100).toFixed(2))),
  }
}

export function isLargeObjectManifestV1(value: unknown): value is LargeObjectManifestV1 {
  if (!value || typeof value !== 'object') return false
  const manifest = value as Partial<LargeObjectManifestV1>
  if (
    manifest.protocol !== LARGE_OBJECT_PROTOCOL ||
    manifest.encryption !== LARGE_OBJECT_ENCRYPTION_SCHEME ||
    typeof manifest.objectId !== 'string' || manifest.objectId.length < 8 || manifest.objectId.length > 120 ||
    typeof manifest.fileName !== 'string' || manifest.fileName.length < 1 || manifest.fileName.length > 180 ||
    typeof manifest.mimeType !== 'string' || manifest.mimeType.length < 1 || manifest.mimeType.length > 120 ||
    typeof manifest.createdAt !== 'string' || !Number.isFinite(Date.parse(manifest.createdAt)) ||
    typeof manifest.plaintextByteLength !== 'number' ||
    typeof manifest.chunkBytes !== 'number' ||
    typeof manifest.chunkCount !== 'number' ||
    !Array.isArray(manifest.chunks)
  ) return false

  try {
    validateLargeObjectByteLength(manifest.plaintextByteLength)
    validateLargeObjectChunkBytes(manifest.chunkBytes)
  } catch {
    return false
  }

  if (
    !Number.isSafeInteger(manifest.chunkCount) ||
    manifest.chunkCount !== Math.ceil(manifest.plaintextByteLength / manifest.chunkBytes) ||
    manifest.chunks.length !== manifest.chunkCount
  ) return false

  let expectedOffset = 0
  for (let index = 0; index < manifest.chunks.length; index += 1) {
    const chunk = manifest.chunks[index]
    if (
      !chunk ||
      chunk.index !== index ||
      chunk.plaintextOffset !== expectedOffset ||
      !Number.isSafeInteger(chunk.plaintextLength) || chunk.plaintextLength <= 0 || chunk.plaintextLength > manifest.chunkBytes ||
      !Number.isSafeInteger(chunk.ciphertextByteLength) || chunk.ciphertextByteLength <= chunk.plaintextLength ||
      typeof chunk.iv !== 'string' || chunk.iv.length < 12 || chunk.iv.length > 64 ||
      typeof chunk.sha256 !== 'string' || !/^[A-Za-z0-9_-]{40,50}$/.test(chunk.sha256)
    ) return false
    expectedOffset += chunk.plaintextLength
  }

  return expectedOffset === manifest.plaintextByteLength
}
