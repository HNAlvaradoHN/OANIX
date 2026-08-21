import {
  LARGE_OBJECT_AES_GCM_TAG_BYTES,
  createLargeObjectTransferProgress,
  planLargeObjectChunks,
  type LargeObjectChunkManifest,
  type LargeObjectChunkPlan,
  type LargeObjectTransferProgress,
} from './largeObjectProtocol.ts'

const GCM_TAG_LENGTH = LARGE_OBJECT_AES_GCM_TAG_BYTES * 8
const LARGE_OBJECT_IV_BYTES = 12

export interface EncryptedLargeObjectChunk {
  manifest: LargeObjectChunkManifest
  ciphertext: Uint8Array
}

export interface ProcessLargeObjectChunksOptions {
  blob: Blob
  vaultKey: CryptoKey
  objectId: string
  chunkBytes?: number
  onProgress?: (progress: LargeObjectTransferProgress) => void
  consumeEncryptedChunk: (chunk: EncryptedLargeObjectChunk) => Promise<void>
}

function requireCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto no está disponible para procesar archivos grandes.')
  }
  return globalThis.crypto
}

function validateVaultKey(vaultKey: CryptoKey, usage: 'encrypt' | 'decrypt'): void {
  if (vaultKey.algorithm.name !== 'AES-GCM') {
    throw new Error('La clave activa de la bóveda no es compatible con AES-GCM.')
  }
  if (!vaultKey.usages.includes(usage)) {
    throw new Error(`La clave activa de la bóveda no permite ${usage === 'encrypt' ? 'cifrar' : 'descifrar'} archivos grandes.`)
  }
}

function validateObjectId(objectId: string): string {
  const normalized = objectId.trim()
  if (normalized.length < 8 || normalized.length > 120) {
    throw new Error('El identificador del archivo grande no es válido.')
  }
  return normalized
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  const step = 0x8000
  for (let offset = 0; offset < bytes.length; offset += step) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + step))
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  let binary: string
  try {
    binary = atob(padded)
  } catch {
    throw new Error('El IV cifrado del fragmento no es válido.')
  }
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function asOwnedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (
    bytes.buffer instanceof ArrayBuffer &&
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength
  ) {
    return bytes.buffer
  }

  const owned = new Uint8Array(bytes.byteLength)
  owned.set(bytes)
  return owned.buffer
}

function buildChunkAdditionalData(objectId: string, plan: LargeObjectChunkPlan): ArrayBuffer {
  const encoded = new TextEncoder().encode(JSON.stringify([
    'OANIX',
    'large-object',
    1,
    objectId,
    plan.index,
    plan.plaintextOffset,
    plan.plaintextLength,
  ]))
  return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength)
}

async function sha256Base64Url(bytes: Uint8Array): Promise<string> {
  const digest = await requireCrypto().subtle.digest('SHA-256', asOwnedArrayBuffer(bytes))
  return bytesToBase64Url(new Uint8Array(digest))
}

export async function verifyLargeObjectChunkSha256(
  ciphertext: Uint8Array,
  expectedSha256: string,
): Promise<void> {
  const actual = await sha256Base64Url(ciphertext)
  if (actual !== expectedSha256) {
    throw new Error('La integridad SHA-256 del fragmento cifrado no coincide con el manifiesto.')
  }
}

export async function decryptLargeObjectChunk(
  vaultKey: CryptoKey,
  objectId: string,
  manifest: LargeObjectChunkManifest,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  validateVaultKey(vaultKey, 'decrypt')
  const normalizedObjectId = validateObjectId(objectId)
  if (ciphertext.byteLength !== manifest.ciphertextByteLength) {
    throw new Error('El fragmento cifrado descargado no coincide con la longitud del manifiesto.')
  }
  await verifyLargeObjectChunkSha256(ciphertext, manifest.sha256)

  const iv = base64UrlToBytes(manifest.iv)
  if (iv.byteLength !== LARGE_OBJECT_IV_BYTES) {
    iv.fill(0)
    throw new Error('El IV cifrado del fragmento no tiene la longitud esperada.')
  }

  try {
    const plaintextBuffer = await requireCrypto().subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: buildChunkAdditionalData(normalizedObjectId, manifest),
        tagLength: GCM_TAG_LENGTH,
      },
      vaultKey,
      asOwnedArrayBuffer(ciphertext),
    )
    const plaintext = new Uint8Array(plaintextBuffer)
    if (plaintext.byteLength !== manifest.plaintextLength) {
      plaintext.fill(0)
      throw new Error('El fragmento descifrado no coincide con la longitud esperada.')
    }
    return plaintext
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('El fragmento descifrado')) throw error
    throw new Error('No se pudo autenticar y descifrar el fragmento remoto de OANIX.')
  } finally {
    iv.fill(0)
  }
}

export async function encryptLargeObjectChunk(
  vaultKey: CryptoKey,
  objectId: string,
  plan: LargeObjectChunkPlan,
  plaintext: Uint8Array,
): Promise<EncryptedLargeObjectChunk> {
  validateVaultKey(vaultKey, 'encrypt')
  const normalizedObjectId = validateObjectId(objectId)
  if (plaintext.byteLength !== plan.plaintextLength) {
    throw new Error('El fragmento leído no coincide con el plan del archivo grande.')
  }

  const cryptoApi = requireCrypto()
  const iv = cryptoApi.getRandomValues(new Uint8Array(LARGE_OBJECT_IV_BYTES))
  const ciphertextBuffer = await cryptoApi.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: buildChunkAdditionalData(normalizedObjectId, plan),
      tagLength: GCM_TAG_LENGTH,
    },
    vaultKey,
    asOwnedArrayBuffer(plaintext),
  )
  const ciphertext = new Uint8Array(ciphertextBuffer)

  return {
    manifest: {
      ...plan,
      ciphertextByteLength: ciphertext.byteLength,
      iv: bytesToBase64Url(iv),
      sha256: await sha256Base64Url(ciphertext),
    },
    ciphertext,
  }
}

export async function processLargeObjectChunks(
  options: ProcessLargeObjectChunksOptions,
): Promise<LargeObjectChunkManifest[]> {
  const { blob, vaultKey, consumeEncryptedChunk, onProgress } = options
  validateVaultKey(vaultKey, 'encrypt')
  const objectId = validateObjectId(options.objectId)
  const plans = planLargeObjectChunks(blob.size, options.chunkBytes)
  const manifests: LargeObjectChunkManifest[] = []
  let processedBytes = 0

  onProgress?.(createLargeObjectTransferProgress('preparing', 0, blob.size))

  for (const plan of plans) {
    const slice = blob.slice(plan.plaintextOffset, plan.plaintextOffset + plan.plaintextLength)
    const plaintext = new Uint8Array(await slice.arrayBuffer())
    let encrypted: EncryptedLargeObjectChunk | null = null

    try {
      onProgress?.(createLargeObjectTransferProgress('encrypting', processedBytes, blob.size))
      encrypted = await encryptLargeObjectChunk(vaultKey, objectId, plan, plaintext)
      onProgress?.(createLargeObjectTransferProgress('uploading', processedBytes, blob.size))
      await consumeEncryptedChunk(encrypted)
      manifests.push(encrypted.manifest)
      processedBytes += plan.plaintextLength
      onProgress?.(createLargeObjectTransferProgress('uploading', processedBytes, blob.size))
    } finally {
      plaintext.fill(0)
      encrypted?.ciphertext.fill(0)
    }
  }

  onProgress?.(createLargeObjectTransferProgress('verifying', processedBytes, blob.size))
  return manifests
}
