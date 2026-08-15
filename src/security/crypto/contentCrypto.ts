const CONTENT_SCHEME = 'aes-gcm-v1' as const
const CONTENT_IV_LENGTH = 12
const GCM_TAG_LENGTH = 128
const MIN_CIPHERTEXT_LENGTH = 16
const BASE64_CHUNK_SIZE = 0x8000

export interface VaultPayloadContext {
  recordType: string
  recordId: string
}

export interface EncryptedVaultPayload {
  scheme: typeof CONTENT_SCHEME
  iv: string
  ciphertext: string
}

function requireWebCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto is not available in this browser.')
  }

  return globalThis.crypto
}

function validateContext(context: VaultPayloadContext): void {
  if (!context.recordType || !context.recordId) {
    throw new Error('Encrypted records require a type and an id.')
  }
}

function buildAdditionalData(context: VaultPayloadContext): ArrayBuffer {
  validateContext(context)
  const encoded = new TextEncoder().encode(
    JSON.stringify(['OANIX', 'content', 1, context.recordType, context.recordId]),
  )
  return Uint8Array.from(encoded).buffer
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''

  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + BASE64_CHUNK_SIZE)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function validateVaultKey(vaultKey: CryptoKey): void {
  if (vaultKey.algorithm.name !== 'AES-GCM') {
    throw new Error('The active vault key is not an AES-GCM key.')
  }
}

export async function encryptVaultBytes(
  vaultKey: CryptoKey,
  plaintext: Uint8Array,
  context: VaultPayloadContext,
): Promise<EncryptedVaultPayload> {
  validateVaultKey(vaultKey)
  const cryptoApi = requireWebCrypto()
  const iv = cryptoApi.getRandomValues(new Uint8Array(CONTENT_IV_LENGTH))
  const ciphertext = await cryptoApi.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: Uint8Array.from(iv).buffer,
      additionalData: buildAdditionalData(context),
      tagLength: GCM_TAG_LENGTH,
    },
    vaultKey,
    Uint8Array.from(plaintext).buffer,
  )

  return {
    scheme: CONTENT_SCHEME,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  }
}

export async function decryptVaultBytes(
  vaultKey: CryptoKey,
  payload: EncryptedVaultPayload,
  context: VaultPayloadContext,
): Promise<Uint8Array> {
  validateVaultKey(vaultKey)

  if (payload.scheme !== CONTENT_SCHEME) {
    throw new Error('Unsupported encrypted content scheme.')
  }

  const iv = base64ToBytes(payload.iv)
  const ciphertext = base64ToBytes(payload.ciphertext)

  if (iv.byteLength !== CONTENT_IV_LENGTH) {
    throw new Error('Invalid encrypted content IV length.')
  }

  if (ciphertext.byteLength < MIN_CIPHERTEXT_LENGTH) {
    throw new Error('Invalid encrypted content length.')
  }

  const cryptoApi = requireWebCrypto()
  const plaintext = await cryptoApi.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: Uint8Array.from(iv).buffer,
      additionalData: buildAdditionalData(context),
      tagLength: GCM_TAG_LENGTH,
    },
    vaultKey,
    Uint8Array.from(ciphertext).buffer,
  )

  return new Uint8Array(plaintext)
}

export async function encryptVaultJson<T>(
  vaultKey: CryptoKey,
  value: T,
  context: VaultPayloadContext,
): Promise<EncryptedVaultPayload> {
  const serialized = JSON.stringify(value)

  if (serialized === undefined) {
    throw new Error('The value cannot be represented as JSON.')
  }

  return encryptVaultBytes(vaultKey, new TextEncoder().encode(serialized), context)
}

export async function decryptVaultJson<T>(
  vaultKey: CryptoKey,
  payload: EncryptedVaultPayload,
  context: VaultPayloadContext,
): Promise<T> {
  const plaintext = await decryptVaultBytes(vaultKey, payload, context)
  return JSON.parse(new TextDecoder().decode(plaintext)) as T
}
