import {
  deleteEncryptedRecord,
  listEncryptedRecords,
  readEncryptedRecord,
  writeEncryptedRecord,
} from '../../storage/repositories/encryptedRecordRepository'
import {
  DEFAULT_FOLDER_COLOR,
  isFolderIcon,
  type FolderIcon,
} from './folderAppearanceCatalog'

const FOLDER_APPEARANCE_RECORD = 'folder-appearance'
const HEX_COLOR = /^#[0-9a-f]{6}$/i

interface FolderAppearanceRecordV1 {
  version: 1
  folderId: string
  color: string
  updatedAt: string
}

interface FolderAppearanceRecordV2 {
  version: 2
  folderId: string
  color?: string
  icon?: FolderIcon
  updatedAt: string
}

export type FolderAppearanceRecord = FolderAppearanceRecordV1 | FolderAppearanceRecordV2

function normalizeColor(color: string): string {
  const normalized = color.trim().toLowerCase()
  if (!HEX_COLOR.test(normalized)) throw new Error('Selecciona un color válido.')
  return normalized
}

function normalizeIcon(icon: string): FolderIcon {
  if (!isFolderIcon(icon)) throw new Error('Selecciona un icono válido.')
  return icon
}

function validRecord(recordId: string, value: FolderAppearanceRecord | null): FolderAppearanceRecord | null {
  if (!value || value.folderId !== recordId) return null
  if (value.version === 1) {
    return HEX_COLOR.test(value.color) ? value : null
  }
  if (value.version !== 2) return null
  if (value.color !== undefined && !HEX_COLOR.test(value.color)) return null
  if (value.icon !== undefined && !isFolderIcon(value.icon)) return null
  return value
}

async function readAppearance(folderId: string): Promise<FolderAppearanceRecord | null> {
  const value = await readEncryptedRecord<FolderAppearanceRecord>(FOLDER_APPEARANCE_RECORD, folderId)
  return validRecord(folderId, value)
}

async function writeAppearance(
  folderId: string,
  appearance: { color?: string; icon?: FolderIcon },
): Promise<void> {
  if (!appearance.color && !appearance.icon) {
    await deleteEncryptedRecord(FOLDER_APPEARANCE_RECORD, folderId)
    return
  }

  const record: FolderAppearanceRecordV2 = {
    version: 2,
    folderId,
    ...(appearance.color ? { color: normalizeColor(appearance.color) } : {}),
    ...(appearance.icon ? { icon: normalizeIcon(appearance.icon) } : {}),
    updatedAt: new Date().toISOString(),
  }
  await writeEncryptedRecord(FOLDER_APPEARANCE_RECORD, folderId, record)
}

export async function loadFolderColors(): Promise<Map<string, string>> {
  const records = await listEncryptedRecords<FolderAppearanceRecord>(FOLDER_APPEARANCE_RECORD)
  const colors = new Map<string, string>()

  for (const record of records) {
    const value = validRecord(record.recordId, record.value)
    if (!value) continue
    const color = value.version === 1 ? value.color : value.color
    if (color && HEX_COLOR.test(color)) colors.set(record.recordId, color.toLowerCase())
  }

  return colors
}

export async function loadFolderIcons(): Promise<Map<string, FolderIcon>> {
  const records = await listEncryptedRecords<FolderAppearanceRecord>(FOLDER_APPEARANCE_RECORD)
  const icons = new Map<string, FolderIcon>()

  for (const record of records) {
    const value = validRecord(record.recordId, record.value)
    if (value?.version === 2 && value.icon && isFolderIcon(value.icon)) {
      icons.set(record.recordId, value.icon)
    }
  }

  return icons
}

export async function saveFolderColor(folderId: string, color: string): Promise<void> {
  const existing = await readAppearance(folderId)
  const icon = existing?.version === 2 ? existing.icon : undefined
  await writeAppearance(folderId, { color: normalizeColor(color), icon })
}

export async function removeFolderColor(folderId: string): Promise<void> {
  const existing = await readAppearance(folderId)
  const icon = existing?.version === 2 ? existing.icon : undefined
  await writeAppearance(folderId, { icon })
}

export async function saveFolderIcon(folderId: string, icon: string): Promise<void> {
  const existing = await readAppearance(folderId)
  const color = existing?.version === 1 ? existing.color : existing?.color
  await writeAppearance(folderId, { color, icon: normalizeIcon(icon) })
}

export async function removeFolderIcon(folderId: string): Promise<void> {
  const existing = await readAppearance(folderId)
  const color = existing?.version === 1 ? existing.color : existing?.color
  await writeAppearance(folderId, { color })
}

export function defaultFolderColor(): string {
  return DEFAULT_FOLDER_COLOR
}
