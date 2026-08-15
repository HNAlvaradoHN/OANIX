import {
  deleteEncryptedRecord,
  listEncryptedRecords,
  readEncryptedRecord,
  writeEncryptedRecord,
} from './encryptedRecordRepository'
import { isFolderRecord, type FolderRecord } from '../../features/folders/folderTypes'

const FOLDER_RECORD_TYPE = 'folder'

export function saveFolder(folder: FolderRecord): Promise<void> {
  return writeEncryptedRecord(FOLDER_RECORD_TYPE, folder.id, folder)
}

export function deleteFolderRecord(folderId: string): Promise<void> {
  return deleteEncryptedRecord(FOLDER_RECORD_TYPE, folderId)
}

export async function readFolder(folderId: string): Promise<FolderRecord | null> {
  const value = await readEncryptedRecord<unknown>(FOLDER_RECORD_TYPE, folderId)
  if (value === null) return null
  if (!isFolderRecord(value) || value.id !== folderId) {
    throw new Error('Stored folder data is invalid.')
  }
  return value
}

export async function listFolders(): Promise<FolderRecord[]> {
  const records = await listEncryptedRecords<unknown>(FOLDER_RECORD_TYPE)
  return records.map(({ recordId, value }) => {
    if (!isFolderRecord(value) || value.id !== recordId) {
      throw new Error('Stored folder data is invalid.')
    }
    return value
  })
}
