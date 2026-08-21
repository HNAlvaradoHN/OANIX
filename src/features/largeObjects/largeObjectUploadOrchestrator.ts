import {
  encryptLargeObjectChunk,
  type EncryptedLargeObjectChunk,
} from './largeObjectChunkCrypto.ts'
import {
  createLargeObjectTransferProgress,
  planLargeObjectChunks,
  type LargeObjectChunkManifest,
  type LargeObjectTransferProgress,
} from './largeObjectProtocol.ts'
import {
  planLargeObjectCiphertextRanges,
  totalCiphertextBytesForRanges,
  type LargeObjectCiphertextRange,
  type LargeObjectRemoteObject,
  type OanixStorageProvider,
} from './largeObjectTransferContract.ts'
import {
  advanceLargeObjectTransferCheckpoint,
  createLargeObjectTransferCheckpoint,
  isLargeObjectTransferCheckpointV1,
  retainLargeObjectChunkForCheckpoint,
  type LargeObjectTransferCheckpointV1,
  type RetainedLargeObjectChunk,
} from './largeObjectTransferCheckpoint.ts'

export interface LargeObjectTransferSnapshot {
  checkpoint: LargeObjectTransferCheckpointV1
  retainedChunk: RetainedLargeObjectChunk | null
  manifests: LargeObjectChunkManifest[]
}

export interface LargeObjectTransferStateStore {
  load(objectId: string): Promise<LargeObjectTransferSnapshot | null>
  save(snapshot: LargeObjectTransferSnapshot): Promise<void>
  clear(objectId: string): Promise<void>
}

export interface UploadLargeObjectOptions {
  blob: Blob
  vaultKey: CryptoKey
  objectId: string
  provider: OanixStorageProvider
  stateStore: LargeObjectTransferStateStore
  chunkBytes?: number
  onProgress?: (progress: LargeObjectTransferProgress) => void
}

export interface UploadLargeObjectResult {
  remoteObject: LargeObjectRemoteObject
  manifests: LargeObjectChunkManifest[]
}

function validateObjectId(objectId: string): string {
  const normalized = objectId.trim()
  if (normalized.length < 8 || normalized.length > 120) {
    throw new Error('El identificador del archivo grande no es válido.')
  }
  return normalized
}

function clearBytes(bytes: Uint8Array | null | undefined): void {
  bytes?.fill(0)
}

function cloneRetainedChunk(chunk: RetainedLargeObjectChunk | null): RetainedLargeObjectChunk | null {
  return chunk ? { ...chunk, ciphertext: chunk.ciphertext.slice() } : null
}

function cloneManifests(manifests: LargeObjectChunkManifest[]): LargeObjectChunkManifest[] {
  return manifests.map((manifest) => ({ ...manifest }))
}

function validateSavedManifests(
  manifests: LargeObjectChunkManifest[],
  ranges: LargeObjectCiphertextRange[],
): void {
  const seen = new Set<number>()
  for (const manifest of manifests) {
    const range = ranges[manifest.index]
    if (
      !range ||
      seen.has(manifest.index) ||
      manifest.plaintextOffset !== range.plaintextOffset ||
      manifest.plaintextLength !== range.plaintextLength ||
      manifest.ciphertextByteLength !== range.ciphertextByteLength ||
      typeof manifest.iv !== 'string' || !manifest.iv ||
      typeof manifest.sha256 !== 'string' || !manifest.sha256
    ) {
      throw new Error('Los manifiestos guardados del archivo grande no son válidos.')
    }
    seen.add(manifest.index)
  }
}

function validateSnapshot(
  snapshot: LargeObjectTransferSnapshot,
  objectId: string,
  provider: OanixStorageProvider,
  expectedCiphertextBytes: number,
  ranges: LargeObjectCiphertextRange[],
): void {
  if (!isLargeObjectTransferCheckpointV1(snapshot.checkpoint)) {
    throw new Error('El checkpoint guardado del archivo grande no es válido.')
  }
  if (
    snapshot.checkpoint.objectId !== objectId ||
    snapshot.checkpoint.providerId !== provider.providerId ||
    snapshot.checkpoint.expectedCiphertextBytes !== expectedCiphertextBytes
  ) {
    throw new Error('El checkpoint guardado pertenece a otra transferencia.')
  }
  if (snapshot.retainedChunk && snapshot.retainedChunk.objectId !== objectId) {
    throw new Error('El fragmento temporal pertenece a otro archivo grande.')
  }
  validateSavedManifests(snapshot.manifests, ranges)
}

function retainedMatchesActiveChunk(
  retained: RetainedLargeObjectChunk | null,
  checkpoint: LargeObjectTransferCheckpointV1,
): retained is RetainedLargeObjectChunk {
  const active = checkpoint.activeChunk
  if (!retained || !active) return false
  return (
    retained.objectId === checkpoint.objectId &&
    retained.chunkIndex === active.chunkIndex &&
    retained.ciphertextOffset === active.ciphertextOffset &&
    retained.ciphertextByteLength === active.ciphertextByteLength &&
    retained.iv === active.iv &&
    retained.sha256 === active.sha256 &&
    retained.ciphertext.byteLength === active.ciphertextByteLength
  )
}

function appendManifestOnce(
  manifests: LargeObjectChunkManifest[],
  manifest: LargeObjectChunkManifest,
): LargeObjectChunkManifest[] {
  const existing = manifests.find((candidate) => candidate.index === manifest.index)
  if (existing) {
    if (existing.iv !== manifest.iv || existing.sha256 !== manifest.sha256) {
      throw new Error('El manifiesto cifrado cambió para un fragmento ya preparado.')
    }
    return manifests
  }
  return [...manifests, { ...manifest }].sort((a, b) => a.index - b.index)
}

export async function uploadLargeObjectResumable(
  options: UploadLargeObjectOptions,
): Promise<UploadLargeObjectResult> {
  const objectId = validateObjectId(options.objectId)
  if (options.blob.size <= 0) throw new Error('El archivo grande no puede estar vacío.')

  const plans = planLargeObjectChunks(options.blob.size, options.chunkBytes)
  const ranges = planLargeObjectCiphertextRanges(options.blob.size, options.chunkBytes)
  const expectedCiphertextBytes = totalCiphertextBytesForRanges(ranges)
  let snapshot = await options.stateStore.load(objectId)

  options.onProgress?.(createLargeObjectTransferProgress('preparing', 0, options.blob.size))

  if (snapshot) {
    validateSnapshot(snapshot, objectId, options.provider, expectedCiphertextBytes, ranges)
    const remoteStatus = await options.provider.inspectResumableUpload({
      providerId: snapshot.checkpoint.providerId,
      sessionRef: snapshot.checkpoint.sessionRef,
      objectId,
      expectedCiphertextBytes,
    })
    const advanced = advanceLargeObjectTransferCheckpoint(
      snapshot.checkpoint,
      ranges,
      remoteStatus.confirmedCiphertextBytes,
    )
    if (advanced.clearRetainedChunk) clearBytes(snapshot.retainedChunk?.ciphertext)
    snapshot = {
      checkpoint: advanced.checkpoint,
      retainedChunk: advanced.clearRetainedChunk ? null : snapshot.retainedChunk,
      manifests: snapshot.manifests,
    }
    await options.stateStore.save(snapshot)
  } else {
    const session = await options.provider.beginResumableUpload({ objectId, expectedCiphertextBytes })
    snapshot = {
      checkpoint: createLargeObjectTransferCheckpoint(session),
      retainedChunk: null,
      manifests: [],
    }
    await options.stateStore.save(snapshot)
  }

  while (snapshot.checkpoint.confirmedCiphertextBytes < expectedCiphertextBytes) {
    const confirmed = snapshot.checkpoint.confirmedCiphertextBytes
    const range = ranges.find((candidate) => (
      confirmed >= candidate.ciphertextOffset &&
      confirmed < candidate.ciphertextOffset + candidate.ciphertextByteLength
    ))
    if (!range) throw new Error('No se pudo ubicar el fragmento que debe continuar la subida.')
    const plan = plans[range.index]
    if (!plan) throw new Error('El plan del fragmento activo no existe.')

    let encrypted: EncryptedLargeObjectChunk | null = null
    let uploadBytes: Uint8Array | null = null
    let retainedForSave: RetainedLargeObjectChunk | null = null

    try {
      if (snapshot.checkpoint.activeChunk) {
        if (!retainedMatchesActiveChunk(snapshot.retainedChunk, snapshot.checkpoint)) {
          throw new Error('Falta el fragmento temporal necesario para reanudar una subida parcial de forma segura.')
        }
        retainedForSave = snapshot.retainedChunk
      } else {
        options.onProgress?.(createLargeObjectTransferProgress('encrypting', plan.plaintextOffset, options.blob.size))
        const plaintext = new Uint8Array(await options.blob.slice(
          plan.plaintextOffset,
          plan.plaintextOffset + plan.plaintextLength,
        ).arrayBuffer())
        try {
          encrypted = await encryptLargeObjectChunk(options.vaultKey, objectId, plan, plaintext)
        } finally {
          plaintext.fill(0)
        }
        const retained = retainLargeObjectChunkForCheckpoint(
          snapshot.checkpoint,
          ranges,
          encrypted.manifest,
          encrypted.ciphertext,
        )
        clearBytes(snapshot.retainedChunk?.ciphertext)
        retainedForSave = retained.retainedChunk
        snapshot = {
          checkpoint: retained.checkpoint,
          retainedChunk: retainedForSave,
          manifests: appendManifestOnce(snapshot.manifests, encrypted.manifest),
        }
        await options.stateStore.save(snapshot)
      }

      if (!retainedForSave) throw new Error('No se pudo preparar el fragmento cifrado activo.')
      const active = snapshot.checkpoint.activeChunk
      if (!active) throw new Error('El checkpoint no conserva el fragmento cifrado activo.')
      const offsetInsideChunk = snapshot.checkpoint.confirmedCiphertextBytes - active.ciphertextOffset
      if (offsetInsideChunk < 0 || offsetInsideChunk >= retainedForSave.ciphertext.byteLength) {
        throw new Error('El punto de reanudación dentro del fragmento no es válido.')
      }

      uploadBytes = retainedForSave.ciphertext.slice(offsetInsideChunk)
      options.onProgress?.(createLargeObjectTransferProgress('uploading', plan.plaintextOffset, options.blob.size))
      const status = await options.provider.uploadCiphertextRange({
        session: {
          providerId: snapshot.checkpoint.providerId,
          sessionRef: snapshot.checkpoint.sessionRef,
          objectId,
          expectedCiphertextBytes,
        },
        ciphertextOffset: snapshot.checkpoint.confirmedCiphertextBytes,
        bytes: uploadBytes,
        totalCiphertextBytes: expectedCiphertextBytes,
      })
      const advanced = advanceLargeObjectTransferCheckpoint(
        snapshot.checkpoint,
        ranges,
        status.confirmedCiphertextBytes,
      )

      if (advanced.clearRetainedChunk) clearBytes(retainedForSave.ciphertext)
      snapshot = {
        checkpoint: advanced.checkpoint,
        retainedChunk: advanced.clearRetainedChunk ? null : retainedForSave,
        manifests: snapshot.manifests,
      }
      await options.stateStore.save(snapshot)

      const completedPlaintext = Math.min(
        options.blob.size,
        range.plaintextOffset + (advanced.clearRetainedChunk ? range.plaintextLength : 0),
      )
      options.onProgress?.(createLargeObjectTransferProgress('uploading', completedPlaintext, options.blob.size))
    } finally {
      clearBytes(uploadBytes)
      clearBytes(encrypted?.ciphertext)
    }
  }

  if (snapshot.manifests.length !== ranges.length) {
    throw new Error('La subida terminó sin conservar todos los manifiestos criptográficos necesarios.')
  }

  options.onProgress?.(createLargeObjectTransferProgress('verifying', options.blob.size, options.blob.size))
  const remoteObject = await options.provider.finalizeResumableUpload({
    providerId: snapshot.checkpoint.providerId,
    sessionRef: snapshot.checkpoint.sessionRef,
    objectId,
    expectedCiphertextBytes,
  })
  const manifests = cloneManifests(snapshot.manifests)
  clearBytes(snapshot.retainedChunk?.ciphertext)
  await options.stateStore.clear(objectId)
  options.onProgress?.(createLargeObjectTransferProgress('stored', options.blob.size, options.blob.size))

  return { remoteObject, manifests }
}

export class MemoryLargeObjectTransferStateStore implements LargeObjectTransferStateStore {
  #snapshot: LargeObjectTransferSnapshot | null = null

  async load(objectId: string): Promise<LargeObjectTransferSnapshot | null> {
    if (!this.#snapshot || this.#snapshot.checkpoint.objectId !== objectId) return null
    return {
      checkpoint: structuredClone(this.#snapshot.checkpoint),
      retainedChunk: cloneRetainedChunk(this.#snapshot.retainedChunk),
      manifests: cloneManifests(this.#snapshot.manifests),
    }
  }

  async save(snapshot: LargeObjectTransferSnapshot): Promise<void> {
    clearBytes(this.#snapshot?.retainedChunk?.ciphertext)
    this.#snapshot = {
      checkpoint: structuredClone(snapshot.checkpoint),
      retainedChunk: cloneRetainedChunk(snapshot.retainedChunk),
      manifests: cloneManifests(snapshot.manifests),
    }
  }

  async clear(objectId: string): Promise<void> {
    if (this.#snapshot?.checkpoint.objectId !== objectId) return
    clearBytes(this.#snapshot.retainedChunk?.ciphertext)
    this.#snapshot = null
  }
}
