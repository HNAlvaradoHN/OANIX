import { argon2id } from 'hash-wasm'

export const MASTER_PASSWORD_MIN_CHARACTERS = 15
export const MASTER_PASSWORD_MAX_CHARACTERS = 256

const KDF_MEMORY_KIB = 65_536
const KDF_ITERATIONS = 3
const KDF_PARALLELISM = 1
const KDF_HASH_LENGTH = 32
const SALT_LENGTH = 16
const VAULT_KEY_LENGTH = 32
const GCM_IV_LENGTH = 12
const GCM_TAG_LENGTH = 128
const VAULT_KEY_AAD = new TextEncoder().encode('OANIX:vault-key:v1')

export interface VaultProtectionMetadata {
  scheme: 'argon2id-aes-gcm-v1'
  kdf: {
    algorithm: 'argon2id'
    version: 19
    memoryKiB: 65536
    iterations: 3
    parallelism: 1
    hashLength: 32
    salt: string
  }
  keyWrap: {
    algorithm: 'AES-GCM'
    iv: string
    wrappedKey: string
  }
}

function requireWebCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto is not available in this browser.')
  }

  return globalThis.crypto
}

function randomBytes(length: number): Uint8Array {
  const cryptoApi = requireWebCrypto()
  return cryptoApi.getRandomValues(new Uint8Array(length))
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function normalizeMasterPassword(password: string): string {
  return password.normalize('NFC')
}

export function validateMasterPassword(password: string): string | null {
  const normalized = normalizeMasterPassword(password)
  const characterCount = Array.from(normalized).length

  if (characterCount < MASTER_PASSWORD_MIN_CHARACTERS) {
    return `Usa al menos ${MASTER_PASSWORD_MIN_CHARACTERS} caracteres. Una frase larga es más fácil de recordar.`
  }

  if (characterCount > MASTER_PASSWORD_MAX_CHARACTERS) {
    return `La contraseña maestra no puede superar ${MASTER_PASSWORD_MAX_CHARACTERS} caracteres.`
  }

  if (normalized.trim().length === 0) {
    return 'La contraseña maestra no puede contener únicamente espacios.'
  }

  return null
}

async function deriveWrappingKeyMaterial(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const result = await argon2id({
    password: normalizeMasterPassword(password),
    salt,
    parallelism: KDF_PARALLELISM,
    iterations: KDF_ITERATIONS,
    memorySize: KDF_MEMORY_KIB,
    hashLength: KDF_HASH_LENGTH,
    outputType: 'binary',
  })

  if (!(result instanceof Uint8Array)) {
    throw new Error('Argon2id returned an unexpected result.')
  }

  return Uint8Array.from(result)
}

async function importAesKey(bytes: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  const cryptoApi = requireWebCrypto()
  const copy = Uint8Array.from(bytes)

  return cryptoApi.subtle.importKey(
    'raw',
    copy.buffer,
    { name: 'AES-GCM' },
    false,
    usages,
  )
}

export async function createVaultProtection(password: string): Promise<{
  protection: VaultProtectionMetadata
  vaultKey: CryptoKey
}> {
  const cryptoApi = requireWebCrypto()
  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(GCM_IV_LENGTH)
  const vaultKeyBytes = randomBytes(VAULT_KEY_LENGTH)
  let wrappingKeyBytes: Uint8Array | null = null

  try {
    wrappingKeyBytes = await deriveWrappingKeyMaterial(password, salt)
    const wrappingKey = await importAesKey(wrappingKeyBytes, ['encrypt'])
    const wrappedKeyBuffer = await cryptoApi.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: Uint8Array.from(iv).buffer,
        additionalData: Uint8Array.from(VAULT_KEY_AAD).buffer,
        tagLength: GCM_TAG_LENGTH,
      },
      wrappingKey,
      Uint8Array.from(vaultKeyBytes).buffer,
    )

    const vaultKey = await importAesKey(vaultKeyBytes, ['encrypt', 'decrypt'])

    return {
      vaultKey,
      protection: {
        scheme: 'argon2id-aes-gcm-v1',
        kdf: {
          algorithm: 'argon2id',
          version: 19,
          memoryKiB: KDF_MEMORY_KIB,
          iterations: KDF_ITERATIONS,
          parallelism: KDF_PARALLELISM,
          hashLength: KDF_HASH_LENGTH,
          salt: bytesToBase64(salt),
        },
        keyWrap: {
          algorithm: 'AES-GCM',
          iv: bytesToBase64(iv),
          wrappedKey: bytesToBase64(new Uint8Array(wrappedKeyBuffer)),
        },
      },
    }
  } finally {
    vaultKeyBytes.fill(0)
    wrappingKeyBytes?.fill(0)
  }
}

export async function openVaultProtection(
  password: string,
  protection: VaultProtectionMetadata,
): Promise<CryptoKey> {
  if (protection.scheme !== 'argon2id-aes-gcm-v1') {
    throw new Error('Unsupported vault protection scheme.')
  }

  const cryptoApi = requireWebCrypto()
  const salt = base64ToBytes(protection.kdf.salt)
  const iv = base64ToBytes(protection.keyWrap.iv)
  const wrappedKey = base64ToBytes(protection.keyWrap.wrappedKey)
  let wrappingKeyBytes: Uint8Array | null = null
  let vaultKeyBytes: Uint8Array | null = null

  try {
    wrappingKeyBytes = await deriveWrappingKeyMaterial(password, salt)
    const wrappingKey = await importAesKey(wrappingKeyBytes, ['decrypt'])
    const vaultKeyBuffer = await cryptoApi.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: Uint8Array.from(iv).buffer,
        additionalData: Uint8Array.from(VAULT_KEY_AAD).buffer,
        tagLength: GCM_TAG_LENGTH,
      },
      wrappingKey,
      Uint8Array.from(wrappedKey).buffer,
    )

    vaultKeyBytes = new Uint8Array(vaultKeyBuffer)

    if (vaultKeyBytes.byteLength !== VAULT_KEY_LENGTH) {
      throw new Error('Invalid vault key length.')
    }

    return await importAesKey(vaultKeyBytes, ['encrypt', 'decrypt'])
  } finally {
    wrappingKeyBytes?.fill(0)
    vaultKeyBytes?.fill(0)
  }
}
