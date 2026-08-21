import type { LargeObjectChunkManifest } from './largeObjectProtocol.ts'
import {
  locateLargeObjectResumePosition,
  totalCiphertextBytesForRanges,
  type LargeObjectCiphertextRange,
  type LargeObjectUploadSession,
} from './largeObjectTransferContract.ts'

export const LARGE_OBJECT_CHECKPOINT_PROTOCOL = 'oanix-large-object-checkpoint-v1' as const

export interface RetainedLargeObjectChunk {
  objectId: string
  chunkIndex: number
  ciphertextOffset: number
  ciphertextByteLength: number
  iv: string
  sha256: string
  ciphertext: Uint8Array
}

export interface LargeObjectCheckpointActiveChunk {
  chunkIndex: number
  ciphertextOffset: number
  ciphertextByteLength: number
  confirmedInsideChunk: number
  iv: string
  sha256: string
}

export interface LargeObjectTransferCheckpointV1 {
  protocol: typeof LARGE_OBJECT_CHECKPOINT_PROTOCOL
  providerId: string
  objectId: string
  sessionRef: string
  expectedCiphertextBytes: number
  confirmedCiphertextBytes: number
  activeChunk: LargeObjectCheckpointActiveChunk | null
  updatedAt: string
}

export interface LargeObjectCheckpointAdvance {
  checkpoint: LargeObjectTransferCheckpointV1
  clearRetainedChunk: boolean
}

function requireSafeNonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} debe ser un entero seguro mayor o igual a cero.`)
  }
  return value
}

function requireText(value: string, label: string, maxLength = 2048): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${label} no es válido.`)
  }
  return normalized
}

function normalizeUpdatedAt(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) {
    throw new Error('La fecha del checkpoint no es válida.')
  }
  return date.toISOString()
}

function activeChunkFromResume(
  ranges: LargeObjectCiphertextRange[],
  confirmedCiphertextBytes: number,
  manifest?: LargeObjectChunkManifest,
): LargeObjectCheckpointActiveChunk | null {
  const resume = locateLargeObjectResumePosition(ranges, confirmedCiphertextBytes)
  if (resume.complete) return null
  const range = ranges[resume.nextChunkIndex]
  if (!range) throw new Error('El checkpoint apunta a un fragmento inexistente.')
  if (!manifest) return null
  if (
    manifest.index !== range.index ||
    manifest.ciphertextByteLength !== range.ciphertextByteLength
  ) {
    throw new Error('El manifiesto retenido no coincide con el rango cifrado activo.')
  }
  return {
    chunkIndex: range.index,
    ciphertextOffset: range.ciphertextOffset,
    ciphertextByteLength: range.ciphertextByteLength,
    confirmedInsideChunk: resume.offsetInsideChunk,
    iv: manifest.iv,
    sha256: manifest.sha256,
  }
}

export function createLargeObjectTransferCheckpoint(
  session: LargeObjectUploadSession,
  confirmedCiphertextBytes = 0,
  updatedAt: string | Date = new Date(),
): LargeObjectTransferCheckpointV1 {
  const expected = requireSafeNonNegativeInteger(
    session.expectedCiphertextBytes,
    'El tamaño cifrado esperado',
  )
  const confirmed = requireSafeNonNegativeInteger(
    confirmedCiphertextBytes,
    'Los bytes cifrados confirmados',
  )
  if (expected <= 0 || confirmed > expected) {
    throw new Error('El progreso inicial del checkpoint no es válido.')
  }
  return {
    protocol: LARGE_OBJECT_CHECKPOINT_PROTOCOL,
    providerId: requireText(session.providerId, 'El proveedor', 120),
    objectId: requireText(session.objectId, 'El identificador del archivo', 120),
    sessionRef: requireText(session.sessionRef, 'La sesión reanudable'),
    expectedCiphertextBytes: expected,
    confirmedCiphertextBytes: confirmed,
    activeChunk: null,
    updatedAt: normalizeUpdatedAt(updatedAt),
  }
}

export function retainLargeObjectChunkForCheckpoint(
  checkpoint: LargeObjectTransferCheckpointV1,
  ranges: LargeObjectCiphertextRange[],
  manifest: LargeObjectChunkManifest,
  ciphertext: Uint8Array,
  updatedAt: string | Date = new Date(),
): { checkpoint: LargeObjectTransferCheckpointV1; retainedChunk: RetainedLargeObjectChunk } {
  if (!isLargeObjectTransferCheckpointV1(checkpoint)) {
    throw new Error('El checkpoint de transferencia no es válido.')
  }
  const total = totalCiphertextBytesForRanges(ranges)
  if (total !== checkpoint.expectedCiphertextBytes) {
    throw new Error('El layout cifrado cambió después de crear el checkpoint.')
  }
  const resume = locateLargeObjectResumePosition(ranges, checkpoint.confirmedCiphertextBytes)
  if (resume.complete) {
    throw new Error('Una transferencia completa no puede retener otro fragmento.')
  }
  const range = ranges[resume.nextChunkIndex]
  if (!range || manifest.index !== range.index) {
    throw new Error('Solo se puede retener el fragmento que corresponde al punto de reanudación.')
  }
  if (
    manifest.ciphertextByteLength !== range.ciphertextByteLength ||
    ciphertext.byteLength !== range.ciphertextByteLength
  ) {
    throw new Error('El ciphertext retenido no coincide con el tamaño planificado.')
  }

  const retainedChunk: RetainedLargeObjectChunk = {
    objectId: checkpoint.objectId,
    chunkIndex: range.index,
    ciphertextOffset: range.ciphertextOffset,
    ciphertextByteLength: range.ciphertextByteLength,
    iv: manifest.iv,
    sha256: manifest.sha256,
    ciphertext: ciphertext.slice(),
  }
  return {
    checkpoint: {
      ...checkpoint,
      activeChunk: activeChunkFromResume(ranges, checkpoint.confirmedCiphertextBytes, manifest),
      updatedAt: normalizeUpdatedAt(updatedAt),
    },
    retainedChunk,
  }
}

export function advanceLargeObjectTransferCheckpoint(
  checkpoint: LargeObjectTransferCheckpointV1,
  ranges: LargeObjectCiphertextRange[],
  confirmedCiphertextBytes: number,
  updatedAt: string | Date = new Date(),
): LargeObjectCheckpointAdvance {
  if (!isLargeObjectTransferCheckpointV1(checkpoint)) {
    throw new Error('El checkpoint de transferencia no es válido.')
  }
  const confirmed = requireSafeNonNegativeInteger(
    confirmedCiphertextBytes,
    'Los bytes cifrados confirmados',
  )
  if (confirmed < checkpoint.confirmedCiphertextBytes) {
    throw new Error('El proveedor no puede retroceder el progreso confirmado.')
  }
  const total = totalCiphertextBytesForRanges(ranges)
  if (total !== checkpoint.expectedCiphertextBytes || confirmed > total) {
    throw new Error('El progreso confirmado no coincide con el objeto cifrado esperado.')
  }

  const previousActive = checkpoint.activeChunk
  const resume = locateLargeObjectResumePosition(ranges, confirmed)
  let activeChunk: LargeObjectCheckpointActiveChunk | null = null
  let clearRetainedChunk = false

  if (previousActive) {
    if (resume.complete || resume.nextChunkIndex !== previousActive.chunkIndex) {
      clearRetainedChunk = true
    } else {
      activeChunk = {
        ...previousActive,
        confirmedInsideChunk: resume.offsetInsideChunk,
      }
    }
  }

  return {
    checkpoint: {
      ...checkpoint,
      confirmedCiphertextBytes: confirmed,
      activeChunk,
      updatedAt: normalizeUpdatedAt(updatedAt),
    },
    clearRetainedChunk,
  }
}

export function isLargeObjectTransferCheckpointV1(
  value: unknown,
): value is LargeObjectTransferCheckpointV1 {
  if (!value || typeof value !== 'object') return false
  const checkpoint = value as Partial<LargeObjectTransferCheckpointV1>
  if (
    checkpoint.protocol !== LARGE_OBJECT_CHECKPOINT_PROTOCOL ||
    typeof checkpoint.providerId !== 'string' || !checkpoint.providerId.trim() || checkpoint.providerId.length > 120 ||
    typeof checkpoint.objectId !== 'string' || checkpoint.objectId.trim().length < 1 || checkpoint.objectId.length > 120 ||
    typeof checkpoint.sessionRef !== 'string' || !checkpoint.sessionRef.trim() || checkpoint.sessionRef.length > 2048 ||
    typeof checkpoint.expectedCiphertextBytes !== 'number' ||
    typeof checkpoint.confirmedCiphertextBytes !== 'number' ||
    typeof checkpoint.updatedAt !== 'string' || !Number.isFinite(Date.parse(checkpoint.updatedAt))
  ) return false

  if (
    !Number.isSafeInteger(checkpoint.expectedCiphertextBytes) || checkpoint.expectedCiphertextBytes <= 0 ||
    !Number.isSafeInteger(checkpoint.confirmedCiphertextBytes) || checkpoint.confirmedCiphertextBytes < 0 ||
    checkpoint.confirmedCiphertextBytes > checkpoint.expectedCiphertextBytes
  ) return false

  if (checkpoint.activeChunk === null) return true
  const active = checkpoint.activeChunk
  return Boolean(
    active &&
    Number.isSafeInteger(active.chunkIndex) && active.chunkIndex >= 0 &&
    Number.isSafeInteger(active.ciphertextOffset) && active.ciphertextOffset >= 0 &&
    Number.isSafeInteger(active.ciphertextByteLength) && active.ciphertextByteLength > 0 &&
    Number.isSafeInteger(active.confirmedInsideChunk) && active.confirmedInsideChunk >= 0 &&
    active.confirmedInsideChunk < active.ciphertextByteLength &&
    typeof active.iv === 'string' && active.iv.length >= 12 && active.iv.length <= 64 &&
    typeof active.sha256 === 'string' && /^[A-Za-z0-9_-]{40,50}$/.test(active.sha256),
  )
}

export class MemorySingleLargeObjectChunkRetention {
  #retained: RetainedLargeObjectChunk | null = null

  replace(chunk: RetainedLargeObjectChunk): void {
    this.clear()
    this.#retained = {
      ...chunk,
      ciphertext: chunk.ciphertext.slice(),
    }
  }

  read(objectId: string): RetainedLargeObjectChunk | null {
    if (!this.#retained || this.#retained.objectId !== objectId) return null
    return {
      ...this.#retained,
      ciphertext: this.#retained.ciphertext.slice(),
    }
  }

  clear(): void {
    this.#retained?.ciphertext.fill(0)
    this.#retained = null
  }
}
