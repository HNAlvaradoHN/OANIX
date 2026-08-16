import {
  deleteEncryptedRecord,
  listEncryptedRecords,
  writeEncryptedRecord,
} from './encryptedRecordRepository'
import {
  isNoteHistorySnapshot,
  NOTE_HISTORY_RECORD_TYPE,
  type NoteHistorySnapshot,
} from '../../features/versionHistory/versionHistoryTypes'

export async function saveNoteHistorySnapshot(snapshot: NoteHistorySnapshot): Promise<void> {
  await writeEncryptedRecord(NOTE_HISTORY_RECORD_TYPE, snapshot.id, snapshot)
}

export async function listNoteHistorySnapshots(): Promise<NoteHistorySnapshot[]> {
  const records = await listEncryptedRecords<unknown>(NOTE_HISTORY_RECORD_TYPE)

  return records.map(({ recordId, value }) => {
    if (!isNoteHistorySnapshot(value) || value.id !== recordId) {
      throw new Error('Stored note history data is invalid.')
    }
    return value
  })
}

export async function deleteNoteHistorySnapshot(snapshotId: string): Promise<void> {
  await deleteEncryptedRecord(NOTE_HISTORY_RECORD_TYPE, snapshotId)
}
