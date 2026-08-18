import {
  deleteEncryptedRecord,
  listEncryptedRecords,
  readEncryptedRecord,
  writeEncryptedRecord,
} from '../../storage/repositories/encryptedRecordRepository'

export const NOTE_PRIVACY_RECORD_TYPE = 'note.privacy'
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

export interface NotePrivacyRecord {
  version: 1
  noteId: string
  updatedAt: string
  lock?: NotePrivacyLock
  privateBox?: boolean
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
  const bits = await cryptoApi.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
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

function isNotePrivacyLock(value: unknown): value is NotePrivacyLock {
  if (!value || typeof value !== 'object') return false
  const lock = value as Partial<NotePrivacyLock>
  return (
    lock.version === 1
    && lock.algorithm === 'PBKDF2-SHA256'
    && Number.isSafeInteger(lock.iterations)
    && (lock.iterations ?? 0) >= 100_000
    && (lock.iterations ?? 0) <= 1_000_000
    && typeof lock.salt === 'string'
    && lock.salt.length > 0
    && typeof lock.verifier === 'string'
    && lock.verifier.length > 0
  )
}

function normalizePrivacyRecord(noteId: string, value: unknown): NotePrivacyRecord | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<NotePrivacyRecord>
  if (record.version !== 1 || record.noteId !== noteId || typeof record.updatedAt !== 'string') return null
  if (record.lock !== undefined && !isNotePrivacyLock(record.lock)) return null
  if (record.privateBox !== undefined && typeof record.privateBox !== 'boolean') return null

  return {
    version: 1,
    noteId,
    updatedAt: record.updatedAt,
    ...(record.lock ? { lock: record.lock } : {}),
    ...(record.privateBox === true ? { privateBox: true } : {}),
  }
}

export async function readNotePrivacy(noteId: string): Promise<NotePrivacyRecord | null> {
  const value = await readEncryptedRecord<unknown>(NOTE_PRIVACY_RECORD_TYPE, noteId)
  if (value === null) return null
  return normalizePrivacyRecord(noteId, value)
}

export async function listNotePrivacy(): Promise<NotePrivacyRecord[]> {
  const records = await listEncryptedRecords<unknown>(NOTE_PRIVACY_RECORD_TYPE)
  return records.flatMap(({ recordId, value }) => {
    const normalized = normalizePrivacyRecord(recordId, value)
    return normalized ? [normalized] : []
  })
}

async function saveNotePrivacy(record: NotePrivacyRecord): Promise<NotePrivacyRecord | null> {
  if (!record.lock && record.privateBox !== true) {
    await deleteEncryptedRecord(NOTE_PRIVACY_RECORD_TYPE, record.noteId)
    return null
  }
  await writeEncryptedRecord(NOTE_PRIVACY_RECORD_TYPE, record.noteId, record)
  return record
}

async function mutateNotePrivacy(
  noteId: string,
  mutate: (current: NotePrivacyRecord) => NotePrivacyRecord,
): Promise<NotePrivacyRecord | null> {
  const current = await readNotePrivacy(noteId) ?? {
    version: 1 as const,
    noteId,
    updatedAt: new Date(0).toISOString(),
  }
  return saveNotePrivacy(mutate(current))
}

export function setNotePrivacyLock(noteId: string, lock: NotePrivacyLock | null): Promise<NotePrivacyRecord | null> {
  return mutateNotePrivacy(noteId, (current) => ({
    ...current,
    updatedAt: new Date().toISOString(),
    ...(lock ? { lock } : { lock: undefined }),
  }))
}

export function setNotePrivateBox(noteId: string, privateBox: boolean): Promise<NotePrivacyRecord | null> {
  return mutateNotePrivacy(noteId, (current) => ({
    ...current,
    updatedAt: new Date().toISOString(),
    ...(privateBox ? { privateBox: true } : { privateBox: undefined }),
  }))
}

export async function cleanupOrphanNotePrivacy(existingNoteIds: Iterable<string>): Promise<void> {
  const allowed = new Set(existingNoteIds)
  const records = await listNotePrivacy()
  await Promise.allSettled(
    records
      .filter((record) => !allowed.has(record.noteId))
      .map((record) => deleteEncryptedRecord(NOTE_PRIVACY_RECORD_TYPE, record.noteId)),
  )
}
