import {
  deleteEncryptedRecord,
  listEncryptedRecords,
  readEncryptedRecord,
  writeEncryptedRecord,
} from '../../storage/repositories/encryptedRecordRepository'
import {
  createNotePrivacyLock,
  NOTE_LOCK_MAX_CHARACTERS,
  NOTE_LOCK_MIN_CHARACTERS,
  notePrivacyCodeLength,
  validateNotePrivacyCode,
  verifyNotePrivacyLock,
  type NotePrivacyLock,
} from './notePrivacyCrypto'

export {
  createNotePrivacyLock,
  NOTE_LOCK_MAX_CHARACTERS,
  NOTE_LOCK_MIN_CHARACTERS,
  notePrivacyCodeLength,
  validateNotePrivacyCode,
  verifyNotePrivacyLock,
}
export type { NotePrivacyLock }

export const NOTE_PRIVACY_RECORD_TYPE = 'note.privacy'

export interface NotePrivacyRecord {
  version: 1
  noteId: string
  updatedAt: string
  lock?: NotePrivacyLock
  privateBox?: boolean
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
