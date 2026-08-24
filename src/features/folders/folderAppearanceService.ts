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
const appearanceWriteQueues = new Map<string, Promise<void>>()

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
  pinned?: boolean
  favorite?: boolean
  updatedAt: string
}

export interface FolderAppearanceFlags {
  pinned: boolean
  favorite: boolean
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
  if (value.pinned !== undefined && typeof value.pinned !== 'boolean') return null
  if (value.favorite !== undefined && typeof value.favorite !== 'boolean') return null
  return value
}

async function readAppearance(folderId: string): Promise<FolderAppearanceRecord | null> {
  const value = await readEncryptedRecord<FolderAppearanceRecord>(FOLDER_APPEARANCE_RECORD, folderId)
  return validRecord(folderId, value)
}

function appearanceParts(existing: FolderAppearanceRecord | null) {
  return {
    color: existing?.version === 1 ? existing.color : existing?.color,
    icon: existing?.version === 2 ? existing.icon : undefined,
    pinned: existing?.version === 2 ? existing.pinned === true : false,
    favorite: existing?.version === 2 ? existing.favorite === true : false,
  }
}

function serializeAppearanceWrite(folderId: string, write: () => Promise<void>): Promise<void> {
  const previous = appearanceWriteQueues.get(folderId) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(write)
  appearanceWriteQueues.set(folderId, next)
  return next.finally(() => {
    if (appearanceWriteQueues.get(folderId) === next) appearanceWriteQueues.delete(folderId)
  })
}

async function writeAppearance(
  folderId: string,
  appearance: { color?: string; icon?: FolderIcon; pinned?: boolean; favorite?: boolean },
): Promise<void> {
  const pinned = appearance.pinned === true
  const favorite = appearance.favorite === true
  if (!appearance.color && !appearance.icon && !pinned && !favorite) {
    await deleteEncryptedRecord(FOLDER_APPEARANCE_RECORD, folderId)
    return
  }

  const record: FolderAppearanceRecordV2 = {
    version: 2,
    folderId,
    ...(appearance.color ? { color: normalizeColor(appearance.color) } : {}),
    ...(appearance.icon ? { icon: normalizeIcon(appearance.icon) } : {}),
    ...(pinned ? { pinned: true } : {}),
    ...(favorite ? { favorite: true } : {}),
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

export async function loadFolderAppearanceFlags(): Promise<Map<string, FolderAppearanceFlags>> {
  const records = await listEncryptedRecords<FolderAppearanceRecord>(FOLDER_APPEARANCE_RECORD)
  const flags = new Map<string, FolderAppearanceFlags>()

  for (const record of records) {
    const value = validRecord(record.recordId, record.value)
    if (value?.version !== 2) continue
    if (value.pinned === true || value.favorite === true) {
      flags.set(record.recordId, {
        pinned: value.pinned === true,
        favorite: value.favorite === true,
      })
    }
  }

  return flags
}

export async function saveFolderColor(folderId: string, color: string): Promise<void> {
  const normalized = normalizeColor(color)
  await serializeAppearanceWrite(folderId, async () => {
    const existing = await readAppearance(folderId)
    const parts = appearanceParts(existing)
    await writeAppearance(folderId, { ...parts, color: normalized })
  })
}

export async function removeFolderColor(folderId: string): Promise<void> {
  await serializeAppearanceWrite(folderId, async () => {
    const existing = await readAppearance(folderId)
    const parts = appearanceParts(existing)
    await writeAppearance(folderId, { icon: parts.icon, pinned: parts.pinned, favorite: parts.favorite })
  })
}

export async function saveFolderIcon(folderId: string, icon: string): Promise<void> {
  const normalized = normalizeIcon(icon)
  await serializeAppearanceWrite(folderId, async () => {
    const existing = await readAppearance(folderId)
    const color = existing?.version === 1 ? existing.color : existing?.color
    const parts = appearanceParts(existing)
    await writeAppearance(folderId, {
      color,
      icon: normalized,
      pinned: parts.pinned,
      favorite: parts.favorite,
    })
  })
}

export async function removeFolderIcon(folderId: string): Promise<void> {
  await serializeAppearanceWrite(folderId, async () => {
    const existing = await readAppearance(folderId)
    const color = existing?.version === 1 ? existing.color : existing?.color
    const parts = appearanceParts(existing)
    await writeAppearance(folderId, { color, pinned: parts.pinned, favorite: parts.favorite })
  })
}

export async function saveFolderPinned(folderId: string, pinned: boolean): Promise<void> {
  await serializeAppearanceWrite(folderId, async () => {
    const existing = await readAppearance(folderId)
    const parts = appearanceParts(existing)
    await writeAppearance(folderId, { ...parts, pinned })
  })
}

export async function saveFolderFavorite(folderId: string, favorite: boolean): Promise<void> {
  await serializeAppearanceWrite(folderId, async () => {
    const existing = await readAppearance(folderId)
    const parts = appearanceParts(existing)
    await writeAppearance(folderId, { ...parts, favorite })
  })
}

export function defaultFolderColor(): string {
  return DEFAULT_FOLDER_COLOR
}
