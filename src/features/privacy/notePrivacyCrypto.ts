export const NOTE_LOCK_MIN_CHARACTERS = 1
export const NOTE_LOCK_MAX_CHARACTERS = 20
const NOTE_LOCK_ITERATIONS = 160_000

export interface NotePrivacyLock {
  version: 1
  algorithm: 'PBKDF2-SHA256'
  iterations: number
  salt: string
  verifier: string
}

function requireCrypto(): Crypto {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('La protección de notas requiere criptografía segura en este dispositivo.')
  }
  return globalThis.crypto
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index]
  }
  return difference === 0
}

export function notePrivacyCodeLength(code: string): number {
  return Array.from(code).length
}

export function validateNotePrivacyCode(code: string): string | null {
  const length = notePrivacyCodeLength(code)
  if (length < NOTE_LOCK_MIN_CHARACTERS || length > NOTE_LOCK_MAX_CHARACTERS) {
    return `El código debe tener entre ${NOTE_LOCK_MIN_CHARACTERS} y ${NOTE_LOCK_MAX_CHARACTERS} caracteres.`
  }
  return null
}

async function deriveVerifier(code: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const cryptoApi = requireCrypto()
  const keyMaterial = await cryptoApi.subtle.importKey(
    'raw',
    new TextEncoder().encode(code),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const saltBuffer = Uint8Array.from(salt).buffer
  const bits = await cryptoApi.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBuffer,
      iterations,
    },
    keyMaterial,
    256,
  )
  return new Uint8Array(bits)
}

export async function createNotePrivacyLock(code: string): Promise<NotePrivacyLock> {
  const validation = validateNotePrivacyCode(code)
  if (validation) throw new Error(validation)

  const cryptoApi = requireCrypto()
  const salt = cryptoApi.getRandomValues(new Uint8Array(16))
  const verifier = await deriveVerifier(code, salt, NOTE_LOCK_ITERATIONS)

  return {
    version: 1,
    algorithm: 'PBKDF2-SHA256',
    iterations: NOTE_LOCK_ITERATIONS,
    salt: bytesToBase64(salt),
    verifier: bytesToBase64(verifier),
  }
}

export async function verifyNotePrivacyLock(code: string, lock: NotePrivacyLock): Promise<boolean> {
  if (validateNotePrivacyCode(code)) return false
  if (
    lock.version !== 1
    || lock.algorithm !== 'PBKDF2-SHA256'
    || !Number.isSafeInteger(lock.iterations)
    || lock.iterations < 100_000
    || lock.iterations > 1_000_000
  ) {
    return false
  }

  try {
    const expected = base64ToBytes(lock.verifier)
    const salt = base64ToBytes(lock.salt)
    if (salt.length < 16 || expected.length !== 32) return false
    const actual = await deriveVerifier(code, salt, lock.iterations)
    return constantTimeEqual(actual, expected)
  } catch {
    return false
  }
}
