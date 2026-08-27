import {
  deleteEncryptedRecord,
  listEncryptedRecords,
  readEncryptedRecord,
  writeEncryptedRecord,
} from './encryptedRecordRepository'
import { isNoteRecord, type NoteRecord } from '../../features/notes/noteTypes'

const NOTE_RECORD_TYPE = 'note'

export async function saveNote(note: NoteRecord, notify = true): Promise<void> {
  await writeEncryptedRecord(NOTE_RECORD_TYPE, note.id, note, notify)
}

export async function deleteNoteRecord(noteId: string): Promise<void> {
  await deleteEncryptedRecord(NOTE_RECORD_TYPE, noteId)
}

export async function readNote(noteId: string): Promise<NoteRecord | null> {
  const value = await readEncryptedRecord<unknown>(NOTE_RECORD_TYPE, noteId)

  if (value === null) return null
  if (!isNoteRecord(value) || value.id !== noteId) {
    throw new Error('Stored note data is invalid.')
  }

  return value
}

export async function listNotes(): Promise<NoteRecord[]> {
  const records = await listEncryptedRecords<unknown>(NOTE_RECORD_TYPE)

  return records.map(({ recordId, value }) => {
    if (!isNoteRecord(value) || value.id !== recordId) {
      throw new Error('Stored note data is invalid.')
    }

    return value
  })
}
