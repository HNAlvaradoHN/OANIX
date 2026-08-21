import type { LargeObjectChunkManifest } from '../../features/largeObjects/largeObjectProtocol.ts'
import {
  isLargeObjectTransferCheckpointV1,
  type LargeObjectTransferCheckpointV1,
  type RetainedLargeObjectChunk,
} from '../../features/largeObjects/largeObjectTransferCheckpoint.ts'
import { requireActiveVaultKey } from '../../security/vault/vaultSession.ts'

const TRANSFER_CACHE_DATABASE_NAME = 'oanix-large-object-transfer-cache-v1'
const TRANSFER_CACHE_DATABASE_VERSION = 1
const TRANSFER_CACHE_STORE = 'active_transfer'
const ACTIVE_TRANSFER_KEY = 'active'
const CACHE_IV_BYTES = 12
const CACHE_GCM_TAG_LENGTH = 128

type TransferCachePurpose = 'checkpoint' | 'chunk' | 'manifests'

interface SealedTransferCacheBytes {
  iv: ArrayBuffer
  ciphertext: ArrayBuffer
}

interface StoredLargeObjectTransferCache {
  key: typeof ACTIVE_TRANSFER_KEY
  objectId: string
  chunkIndex: number | null
  checkpoint: SealedTransferCacheBytes
  retainedChunk: SealedTransferCacheBytes | null
  manifests?: SealedTransferCacheBytes | null
}

export interface LoadedLargeObjectTransferCache {
  checkpoint: LargeObjectTransferCheckpointV1
  retainedChunk: RetainedLargeObjectChunk | null
  manifests: LargeObjectChunkManifest[]
}

function requireCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto no está disponible para proteger la transferencia grande.')
  }
  return globalThis.crypto
}

function validateVaultKey(vaultKey: CryptoKey): void {
  if (vaultKey.algorithm.name !== 'AES-GCM') {
    throw new Error('La caché temporal requiere la clave AES-GCM activa de la bóveda.')
  }
}

function cacheAdditionalData(
  purpose: TransferCachePurpose,
  objectId: string,
  chunkIndex: number | null,
): ArrayBuffer {
  const encoded = new TextEncoder().encode(JSON.stringify([
    'OANIX',
    'large-object-transfer-cache',
    1,
    purpose,
    objectId,
    chunkIndex,
  ]))
  return Uint8Array.from(encoded).buffer
}

export async function sealLargeObjectTransferCacheBytes(
  vaultKey: CryptoKey,
  bytes: Uint8Array,
  purpose: TransferCachePurpose,
  objectId: string,
  chunkIndex: number | null = null,
): Promise<SealedTransferCacheBytes> {
  validateVaultKey(vaultKey)
  if (!objectId.trim()) throw new Error('La caché temporal necesita un objectId válido.')
  const cryptoApi = requireCrypto()
  const iv = cryptoApi.getRandomValues(new Uint8Array(CACHE_IV_BYTES))
  const ciphertext = await cryptoApi.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: Uint8Array.from(iv).buffer,
      additionalData: cacheAdditionalData(purpose, objectId, chunkIndex),
      tagLength: CACHE_GCM_TAG_LENGTH,
    },
    vaultKey,
    Uint8Array.from(bytes).buffer,
  )
  return {
    iv: Uint8Array.from(iv).buffer,
    ciphertext,
  }
}

export async function openLargeObjectTransferCacheBytes(
  vaultKey: CryptoKey,
  sealed: SealedTransferCacheBytes,
  purpose: TransferCachePurpose,
  objectId: string,
  chunkIndex: number | null = null,
): Promise<Uint8Array> {
  validateVaultKey(vaultKey)
  if (sealed.iv.byteLength !== CACHE_IV_BYTES || sealed.ciphertext.byteLength < 16) {
    throw new Error('La caché temporal cifrada no es válida.')
  }
  const plaintext = await requireCrypto().subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: sealed.iv.slice(0),
      additionalData: cacheAdditionalData(purpose, objectId, chunkIndex),
      tagLength: CACHE_GCM_TAG_LENGTH,
    },
    vaultKey,
    sealed.ciphertext.slice(0),
  )
  return new Uint8Array(plaintext)
}

function openTransferCacheDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('IndexedDB no está disponible para reanudar archivos grandes.'))
      return
    }
    const request = indexedDB.open(TRANSFER_CACHE_DATABASE_NAME, TRANSFER_CACHE_DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(TRANSFER_CACHE_STORE)) {
        database.createObjectStore(TRANSFER_CACHE_STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      resolve(database)
    }
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir la caché temporal.'))
    request.onblocked = () => reject(new Error('Otra instancia de OANIX bloquea la caché temporal.'))
  })
}

function transactionCompleted(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Falló la transacción temporal.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('La transacción temporal fue cancelada.'))
  })
}

async function readStoredTransfer(database: IDBDatabase): Promise<StoredLargeObjectTransferCache | null> {
  const transaction = database.transaction(TRANSFER_CACHE_STORE, 'readonly')
  const completion = transactionCompleted(transaction)
  const request = transaction.objectStore(TRANSFER_CACHE_STORE).get(ACTIVE_TRANSFER_KEY)
  const stored = await new Promise<StoredLargeObjectTransferCache | null>((resolve, reject) => {
    request.onsuccess = () => resolve((request.result as StoredLargeObjectTransferCache | undefined) ?? null)
    request.onerror = () => reject(request.error ?? new Error('No se pudo leer la caché temporal.'))
  })
  await completion
  return stored
}

function validateCheckpointAndChunk(
  checkpoint: LargeObjectTransferCheckpointV1,
  retainedChunk: RetainedLargeObjectChunk | null,
): void {
  if (!isLargeObjectTransferCheckpointV1(checkpoint)) {
    throw new Error('El checkpoint no es válido y no se guardará.')
  }
  if (!retainedChunk) {
    if (checkpoint.activeChunk) {
      throw new Error('El checkpoint activo necesita su único fragmento cifrado retenido.')
    }
    return
  }
  const active = checkpoint.activeChunk
  if (
    !active ||
    retainedChunk.objectId !== checkpoint.objectId ||
    retainedChunk.chunkIndex !== active.chunkIndex ||
    retainedChunk.ciphertextOffset !== active.ciphertextOffset ||
    retainedChunk.ciphertextByteLength !== active.ciphertextByteLength ||
    retainedChunk.ciphertext.byteLength !== active.ciphertextByteLength ||
    retainedChunk.iv !== active.iv ||
    retainedChunk.sha256 !== active.sha256
  ) {
    throw new Error('El fragmento temporal no coincide con el checkpoint activo.')
  }
}

function validateManifests(manifests: unknown): LargeObjectChunkManifest[] {
  if (!Array.isArray(manifests)) {
    throw new Error('Los manifiestos temporales no son válidos.')
  }
  const seen = new Set<number>()
  const validated: LargeObjectChunkManifest[] = []
  for (const candidate of manifests) {
    if (!candidate || typeof candidate !== 'object') {
      throw new Error('Los manifiestos temporales no son válidos.')
    }
    const manifest = candidate as Partial<LargeObjectChunkManifest>
    if (
      !Number.isSafeInteger(manifest.index) || (manifest.index ?? -1) < 0 ||
      !Number.isSafeInteger(manifest.plaintextOffset) || (manifest.plaintextOffset ?? -1) < 0 ||
      !Number.isSafeInteger(manifest.plaintextLength) || (manifest.plaintextLength ?? 0) <= 0 ||
      !Number.isSafeInteger(manifest.ciphertextByteLength) || (manifest.ciphertextByteLength ?? 0) <= 16 ||
      typeof manifest.iv !== 'string' || !manifest.iv ||
      typeof manifest.sha256 !== 'string' || !manifest.sha256 ||
      seen.has(manifest.index as number)
    ) {
      throw new Error('Los manifiestos temporales no son válidos.')
    }
    seen.add(manifest.index as number)
    validated.push({
      index: manifest.index as number,
      plaintextOffset: manifest.plaintextOffset as number,
      plaintextLength: manifest.plaintextLength as number,
      ciphertextByteLength: manifest.ciphertextByteLength as number,
      iv: manifest.iv,
      sha256: manifest.sha256,
    })
  }
  return validated.sort((a, b) => a.index - b.index)
}

export async function saveLargeObjectTransferCache(
  checkpoint: LargeObjectTransferCheckpointV1,
  retainedChunk: RetainedLargeObjectChunk | null,
  manifests: LargeObjectChunkManifest[] = [],
): Promise<void> {
  validateCheckpointAndChunk(checkpoint, retainedChunk)
  const safeManifests = validateManifests(manifests)
  const vaultKey = requireActiveVaultKey()
  validateVaultKey(vaultKey)
  const checkpointBytes = new TextEncoder().encode(JSON.stringify(checkpoint))
  const manifestsBytes = new TextEncoder().encode(JSON.stringify(safeManifests))
  let checkpointSealed: SealedTransferCacheBytes | null = null
  let retainedSealed: SealedTransferCacheBytes | null = null
  let manifestsSealed: SealedTransferCacheBytes | null = null

  try {
    checkpointSealed = await sealLargeObjectTransferCacheBytes(
      vaultKey,
      checkpointBytes,
      'checkpoint',
      checkpoint.objectId,
      null,
    )
    manifestsSealed = await sealLargeObjectTransferCacheBytes(
      vaultKey,
      manifestsBytes,
      'manifests',
      checkpoint.objectId,
      null,
    )
    if (retainedChunk) {
      retainedSealed = await sealLargeObjectTransferCacheBytes(
        vaultKey,
        retainedChunk.ciphertext,
        'chunk',
        checkpoint.objectId,
        retainedChunk.chunkIndex,
      )
    }

    const database = await openTransferCacheDatabase()
    try {
      const existing = await readStoredTransfer(database)
      if (existing && existing.objectId !== checkpoint.objectId) {
        throw new Error('Ya existe otra transferencia grande pendiente; debe finalizarse o descartarse primero.')
      }
      const transaction = database.transaction(TRANSFER_CACHE_STORE, 'readwrite')
      const completion = transactionCompleted(transaction)
      const stored: StoredLargeObjectTransferCache = {
        key: ACTIVE_TRANSFER_KEY,
        objectId: checkpoint.objectId,
        chunkIndex: retainedChunk?.chunkIndex ?? null,
        checkpoint: checkpointSealed,
        retainedChunk: retainedSealed,
        manifests: manifestsSealed,
      }
      transaction.objectStore(TRANSFER_CACHE_STORE).put(stored)
      await completion
    } finally {
      database.close()
    }
  } finally {
    checkpointBytes.fill(0)
    manifestsBytes.fill(0)
  }
}

export async function loadLargeObjectTransferCache(): Promise<LoadedLargeObjectTransferCache | null> {
  const vaultKey = requireActiveVaultKey()
  validateVaultKey(vaultKey)
  const database = await openTransferCacheDatabase()
  let stored: StoredLargeObjectTransferCache | null = null
  try {
    stored = await readStoredTransfer(database)
  } finally {
    database.close()
  }
  if (!stored) return null

  const checkpointBytes = await openLargeObjectTransferCacheBytes(
    vaultKey,
    stored.checkpoint,
    'checkpoint',
    stored.objectId,
    null,
  )
  let retainedBytes: Uint8Array | null = null
  let manifestsBytes: Uint8Array | null = null
  try {
    const checkpoint = JSON.parse(new TextDecoder().decode(checkpointBytes)) as unknown
    if (!isLargeObjectTransferCheckpointV1(checkpoint) || checkpoint.objectId !== stored.objectId) {
      throw new Error('El checkpoint temporal no supera la validación de OANIX.')
    }

    let manifests: LargeObjectChunkManifest[] = []
    if (stored.manifests) {
      manifestsBytes = await openLargeObjectTransferCacheBytes(
        vaultKey,
        stored.manifests,
        'manifests',
        stored.objectId,
        null,
      )
      manifests = validateManifests(JSON.parse(new TextDecoder().decode(manifestsBytes)) as unknown)
    }

    let retainedChunk: RetainedLargeObjectChunk | null = null
    if (stored.retainedChunk) {
      if (stored.chunkIndex === null || !checkpoint.activeChunk || stored.chunkIndex !== checkpoint.activeChunk.chunkIndex) {
        throw new Error('La caché temporal contiene un fragmento que no corresponde al checkpoint.')
      }
      retainedBytes = await openLargeObjectTransferCacheBytes(
        vaultKey,
        stored.retainedChunk,
        'chunk',
        stored.objectId,
        stored.chunkIndex,
      )
      retainedChunk = {
        objectId: checkpoint.objectId,
        chunkIndex: checkpoint.activeChunk.chunkIndex,
        ciphertextOffset: checkpoint.activeChunk.ciphertextOffset,
        ciphertextByteLength: checkpoint.activeChunk.ciphertextByteLength,
        iv: checkpoint.activeChunk.iv,
        sha256: checkpoint.activeChunk.sha256,
        ciphertext: retainedBytes.slice(),
      }
    }

    validateCheckpointAndChunk(checkpoint, retainedChunk)
    return { checkpoint, retainedChunk, manifests }
  } finally {
    checkpointBytes.fill(0)
    retainedBytes?.fill(0)
    manifestsBytes?.fill(0)
  }
}

export async function clearLargeObjectTransferCache(): Promise<void> {
  requireActiveVaultKey()
  const database = await openTransferCacheDatabase()
  try {
    const transaction = database.transaction(TRANSFER_CACHE_STORE, 'readwrite')
    const completion = transactionCompleted(transaction)
    transaction.objectStore(TRANSFER_CACHE_STORE).delete(ACTIVE_TRANSFER_KEY)
    await completion
  } finally {
    database.close()
  }
}
