import {
  DEFAULT_LARGE_OBJECT_CHUNK_BYTES,
  planLargeObjectChunks,
  type LargeObjectChunkPlan,
} from './largeObjectProtocol.ts'

// AES-GCM appends one 128-bit authentication tag to every independently
// encrypted chunk. The IV lives in the encrypted manifest, not in the remote body.
export const LARGE_OBJECT_GCM_TAG_BYTES = 16

export interface LargeObjectCiphertextRange extends LargeObjectChunkPlan {
  ciphertextOffset: number
  ciphertextByteLength: number
}

export interface LargeObjectResumePosition {
  confirmedCiphertextBytes: number
  nextChunkIndex: number
  offsetInsideChunk: number
  complete: boolean
}

export interface LargeObjectRemoteObject {
  providerId: string
  objectRef: string
  ciphertextByteLength: number
}

export interface LargeObjectUploadSession {
  providerId: string
  sessionRef: string
  objectId: string
  expectedCiphertextBytes: number
}

export interface LargeObjectUploadStatus {
  confirmedCiphertextBytes: number
  complete: boolean
}

export interface LargeObjectUploadRangeRequest {
  session: LargeObjectUploadSession
  ciphertextOffset: number
  bytes: Uint8Array
  totalCiphertextBytes: number
}

export interface LargeObjectDownloadRangeRequest {
  remoteObject: LargeObjectRemoteObject
  ciphertextOffset: number
  ciphertextByteLength: number
}

export interface OanixStorageProvider {
  readonly providerId: string
  beginResumableUpload(input: {
    objectId: string
    expectedCiphertextBytes: number
  }): Promise<LargeObjectUploadSession>
  inspectResumableUpload(session: LargeObjectUploadSession): Promise<LargeObjectUploadStatus>
  uploadCiphertextRange(request: LargeObjectUploadRangeRequest): Promise<LargeObjectUploadStatus>
  finalizeResumableUpload(session: LargeObjectUploadSession): Promise<LargeObjectRemoteObject>
  downloadCiphertextRange(request: LargeObjectDownloadRangeRequest): Promise<Uint8Array>
  deleteRemoteObject(remoteObject: LargeObjectRemoteObject): Promise<void>
}

function requireSafeNonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} debe ser un entero seguro mayor o igual a cero.`)
  }
  return value
}

export function planLargeObjectCiphertextRanges(
  plaintextByteLength: number,
  chunkBytes = DEFAULT_LARGE_OBJECT_CHUNK_BYTES,
): LargeObjectCiphertextRange[] {
  const plans = planLargeObjectChunks(plaintextByteLength, chunkBytes)
  let ciphertextOffset = 0

  return plans.map((plan) => {
    const ciphertextByteLength = plan.plaintextLength + LARGE_OBJECT_GCM_TAG_BYTES
    const range: LargeObjectCiphertextRange = {
      ...plan,
      ciphertextOffset,
      ciphertextByteLength,
    }
    ciphertextOffset += ciphertextByteLength
    return range
  })
}

export function totalCiphertextBytesForRanges(ranges: LargeObjectCiphertextRange[]): number {
  if (ranges.length === 0) throw new Error('El archivo grande debe contener al menos un fragmento.')
  const last = ranges.at(-1)
  if (!last) throw new Error('No se pudo calcular el tamaño cifrado del archivo grande.')
  return last.ciphertextOffset + last.ciphertextByteLength
}

export function locateLargeObjectResumePosition(
  ranges: LargeObjectCiphertextRange[],
  confirmedCiphertextBytes: number,
): LargeObjectResumePosition {
  const confirmed = requireSafeNonNegativeInteger(
    confirmedCiphertextBytes,
    'Los bytes cifrados confirmados',
  )
  const total = totalCiphertextBytesForRanges(ranges)
  if (confirmed > total) {
    throw new Error('El proveedor reportó más bytes confirmados que el archivo cifrado esperado.')
  }
  if (confirmed === total) {
    return {
      confirmedCiphertextBytes: confirmed,
      nextChunkIndex: ranges.length,
      offsetInsideChunk: 0,
      complete: true,
    }
  }

  for (const range of ranges) {
    const end = range.ciphertextOffset + range.ciphertextByteLength
    if (confirmed < end) {
      return {
        confirmedCiphertextBytes: confirmed,
        nextChunkIndex: range.index,
        offsetInsideChunk: confirmed - range.ciphertextOffset,
        complete: false,
      }
    }
  }

  throw new Error('No se pudo ubicar el punto de reanudación del archivo grande.')
}

export function validateUploadRangeRequest(request: LargeObjectUploadRangeRequest): void {
  const offset = requireSafeNonNegativeInteger(request.ciphertextOffset, 'El offset remoto')
  const total = requireSafeNonNegativeInteger(request.totalCiphertextBytes, 'El tamaño cifrado total')
  if (total <= 0 || request.bytes.byteLength <= 0) {
    throw new Error('La transferencia reanudable no acepta rangos vacíos.')
  }
  if (request.session.expectedCiphertextBytes !== total) {
    throw new Error('La sesión de subida no coincide con el tamaño cifrado esperado.')
  }
  if (offset + request.bytes.byteLength > total) {
    throw new Error('El rango cifrado excede el tamaño remoto esperado.')
  }
}
