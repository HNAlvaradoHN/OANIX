import {
  applyEncryptedV2Changes,
  type EncryptedV2Write,
  writeEncryptedV2Records,
} from '../../storage/repositories/encryptedV2RecordRepository'
import { createEntityPendingWrite, nextEntityRevision } from './entitySyncWrites'
import {
  FOLDER_V2_TYPE,
  TAG_V2_TYPE,
  V2_FOLDER_GRADIENTS,
  type FolderV2Record,
  type TagV2Record,
} from './rebuildModel'

const HEX_COLOR = /^#[0-9a-f]{6}$/i

export interface FolderCustomizationInput {
  name?: string
  icon?: string
  gradientIndex?: number
  customColor?: string | null
  coverAssetId?: string | null
  pinned?: boolean
  favorite?: boolean
}

export interface TagCustomizationInput {
  name?: string
  color?: string
}

function normalizeName(value: string, max: number, emptyMessage: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) throw new Error(emptyMessage)
  if (normalized.length > max) throw new Error(`El nombre no puede superar ${max} caracteres.`)
  return normalized
}

function normalizeColor(value: string | null | undefined): string | null | undefined {
  if (value == null) return value
  const normalized = value.trim().toLowerCase()
  if (!HEX_COLOR.test(normalized)) throw new Error('El color debe usar formato hexadecimal #RRGGBB.')
  return normalized
}

function normalizeCoverAssetId(value: string | null | undefined): string | null | undefined {
  if (value == null) return value
  const normalized = value.trim()
  if (!normalized) return null
  if (normalized.length > 180) throw new Error('La referencia de portada es demasiado larga.')
  return normalized
}

function arraysContainSameIds(records: Array<{ id: string }>, orderedIds: string[]): boolean {
  if (records.length !== orderedIds.length) return false
  const expected = new Set(records.map((record) => record.id))
  if (expected.size !== records.length) return false
  const received = new Set(orderedIds)
  if (received.size !== orderedIds.length) return false
  return orderedIds.every((id) => expected.has(id))
}

async function persistEntityUpdate<T extends { id: string; revision?: number }>(
  unitType: string,
  value: T,
  queuedAt: string,
): Promise<void> {
  await applyEncryptedV2Changes({
    writes: [
      { recordType: unitType, recordId: value.id, value },
      createEntityPendingWrite(unitType, value.id, value.revision!, 'upsert', queuedAt),
    ],
  })
}

export async function customizeRebuildFolder(
  existing: FolderV2Record,
  input: FolderCustomizationInput,
): Promise<FolderV2Record> {
  const nextName = input.name === undefined
    ? existing.name
    : normalizeName(input.name, 60, 'Escribe un nombre para la carpeta.')
  const nextIcon = input.icon === undefined ? existing.icon : input.icon.trim()
  if (!nextIcon || nextIcon.length > 16) throw new Error('El icono de la carpeta no es válido.')

  const nextGradientIndex = input.gradientIndex === undefined
    ? existing.gradientIndex
    : input.gradientIndex
  if (
    !Number.isSafeInteger(nextGradientIndex)
    || nextGradientIndex < 0
    || nextGradientIndex >= V2_FOLDER_GRADIENTS.length
  ) {
    throw new Error('El degradado de la carpeta no es válido.')
  }

  const nextColor = input.customColor === undefined
    ? existing.customColor ?? null
    : normalizeColor(input.customColor) ?? null
  const nextCoverAssetId = input.coverAssetId === undefined
    ? existing.coverAssetId ?? null
    : normalizeCoverAssetId(input.coverAssetId) ?? null
  const nextPinned = input.pinned === undefined ? existing.pinned === true : input.pinned === true
  const nextFavorite = input.favorite === undefined ? existing.favorite === true : input.favorite === true

  if (
    nextName === existing.name
    && nextIcon === existing.icon
    && nextGradientIndex === existing.gradientIndex
    && nextColor === (existing.customColor ?? null)
    && nextCoverAssetId === (existing.coverAssetId ?? null)
    && nextPinned === (existing.pinned === true)
    && nextFavorite === (existing.favorite === true)
  ) {
    return existing
  }

  const queuedAt = new Date().toISOString()
  const updated: FolderV2Record = {
    ...existing,
    revision: nextEntityRevision(existing),
    name: nextName,
    icon: nextIcon,
    gradientIndex: nextGradientIndex,
    customColor: nextColor,
    coverAssetId: nextCoverAssetId,
    ...(nextPinned ? { pinned: true } : { pinned: false }),
    ...(nextFavorite ? { favorite: true } : { favorite: false }),
    updatedAt: queuedAt,
  }

  await persistEntityUpdate(FOLDER_V2_TYPE, updated, queuedAt)
  return updated
}

export async function customizeRebuildTag(
  existing: TagV2Record,
  input: TagCustomizationInput,
): Promise<TagV2Record> {
  const nextName = input.name === undefined
    ? existing.name
    : normalizeName(input.name, 40, 'Escribe un nombre para la etiqueta.')
  const nextColor = input.color === undefined
    ? existing.color
    : normalizeColor(input.color)
  if (!nextColor) throw new Error('El color de la etiqueta no es válido.')

  if (nextName === existing.name && nextColor === existing.color.toLowerCase()) return existing

  const queuedAt = new Date().toISOString()
  const updated: TagV2Record = {
    ...existing,
    revision: nextEntityRevision(existing),
    name: nextName,
    color: nextColor,
    updatedAt: queuedAt,
  }

  await persistEntityUpdate(TAG_V2_TYPE, updated, queuedAt)
  return updated
}

export async function reorderRebuildFolders(
  folders: FolderV2Record[],
  orderedIds: string[],
): Promise<FolderV2Record[]> {
  if (!arraysContainSameIds(folders, orderedIds)) {
    throw new Error('El nuevo orden de carpetas está incompleto.')
  }

  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const now = new Date().toISOString()
  const ordered = orderedIds.map((id, order) => {
    const folder = byId.get(id)!
    return folder.order === order
      ? folder
      : { ...folder, revision: nextEntityRevision(folder), order, updatedAt: now }
  })
  const changed = ordered.filter((folder, order) => folder !== byId.get(orderedIds[order]))
  const writes: EncryptedV2Write[] = changed.flatMap((folder) => [
    { recordType: FOLDER_V2_TYPE, recordId: folder.id, value: folder },
    createEntityPendingWrite(FOLDER_V2_TYPE, folder.id, folder.revision!, 'upsert', now),
  ])

  if (writes.length > 0) await writeEncryptedV2Records(writes)
  return ordered
}

export async function reorderRebuildTags(
  tags: TagV2Record[],
  orderedIds: string[],
): Promise<TagV2Record[]> {
  if (!arraysContainSameIds(tags, orderedIds)) {
    throw new Error('El nuevo orden de etiquetas está incompleto.')
  }

  const byId = new Map(tags.map((tag) => [tag.id, tag]))
  const now = new Date().toISOString()
  const ordered = orderedIds.map((id, order) => {
    const tag = byId.get(id)!
    return tag.order === order
      ? tag
      : { ...tag, revision: nextEntityRevision(tag), order, updatedAt: now }
  })
  const changed = ordered.filter((tag, order) => tag !== byId.get(orderedIds[order]))
  const writes: EncryptedV2Write[] = changed.flatMap((tag) => [
    { recordType: TAG_V2_TYPE, recordId: tag.id, value: tag },
    createEntityPendingWrite(TAG_V2_TYPE, tag.id, tag.revision!, 'upsert', now),
  ])

  if (writes.length > 0) await writeEncryptedV2Records(writes)
  return ordered
}

export function sortWorkspaceFolders(folders: FolderV2Record[]): FolderV2Record[] {
  return [...folders].sort((left, right) => {
    const leftOrder = Number.isSafeInteger(left.order) ? left.order! : Number.MAX_SAFE_INTEGER
    const rightOrder = Number.isSafeInteger(right.order) ? right.order! : Number.MAX_SAFE_INTEGER
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    return Date.parse(left.createdAt) - Date.parse(right.createdAt)
  })
}

export function sortWorkspaceTags(tags: TagV2Record[]): TagV2Record[] {
  return [...tags].sort((left, right) => {
    const leftOrder = Number.isSafeInteger(left.order) ? left.order! : Number.MAX_SAFE_INTEGER
    const rightOrder = Number.isSafeInteger(right.order) ? right.order! : Number.MAX_SAFE_INTEGER
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    return left.name.localeCompare(right.name, 'es', { sensitivity: 'base' })
  })
}
