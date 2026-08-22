import {
  deleteEncryptedRecord,
  listEncryptedRecords,
  writeEncryptedRecord,
} from '../../storage/repositories/encryptedRecordRepository'

const FOLDER_APPEARANCE_RECORD = 'folder-appearance'
const HEX_COLOR = /^#[0-9a-f]{6}$/i

export interface FolderAppearanceRecord {
  version: 1
  folderId: string
  color: string
  updatedAt: string
}

function normalizeColor(color: string): string {
  const normalized = color.trim().toLowerCase()
  if (!HEX_COLOR.test(normalized)) throw new Error('Selecciona un color válido.')
  return normalized
}

export async function loadFolderColors(): Promise<Map<string, string>> {
  const records = await listEncryptedRecords<FolderAppearanceRecord>(FOLDER_APPEARANCE_RECORD)
  const colors = new Map<string, string>()

  for (const record of records) {
    const value = record.value
    if (
      value?.version === 1
      && value.folderId === record.recordId
      && typeof value.color === 'string'
      && HEX_COLOR.test(value.color)
    ) {
      colors.set(value.folderId, value.color.toLowerCase())
    }
  }

  return colors
}

export async function saveFolderColor(folderId: string, color: string): Promise<void> {
  const record: FolderAppearanceRecord = {
    version: 1,
    folderId,
    color: normalizeColor(color),
    updatedAt: new Date().toISOString(),
  }
  await writeEncryptedRecord(FOLDER_APPEARANCE_RECORD, folderId, record)
}

export function removeFolderColor(folderId: string): Promise<void> {
  return deleteEncryptedRecord(FOLDER_APPEARANCE_RECORD, folderId)
}
