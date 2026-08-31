import {
  listEncryptedV2Records,
  readEncryptedV2Record,
  writeEncryptedV2Record,
  writeEncryptedV2Records,
} from '../../storage/repositories/encryptedV2RecordRepository'
import {
  FOLDER_V2_TYPE,
  NOTE_V2_BODY_TYPE,
  NOTE_V2_META_TYPE,
  TAG_V2_TYPE,
  V2_FOLDER_GRADIENTS,
  V2_FOLDER_ICONS,
  type FolderV2Record,
  type NoteV2Body,
  type NoteV2Meta,
  type TagV2Record,
} from './rebuildModel'

export interface RebuildWorkspaceSnapshot {
  notes: NoteV2Meta[]
  folders: FolderV2Record[]
  tags: TagV2Record[]
}

function createId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random generation is not available in this browser.')
  }
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function secureRandomIndex(length: number): number {
  if (length <= 1) return 0
  if (!globalThis.crypto?.getRandomValues) return 0
  const value = globalThis.crypto.getRandomValues(new Uint32Array(1))[0]
  return value % length
}

function normalizeName(value: string, max: number, emptyMessage: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) throw new Error(emptyMessage)
  if (normalized.length > max) throw new Error(`El nombre no puede superar ${max} caracteres.`)
  return normalized
}

function validateNoteMeta(value: NoteV2Meta): NoteV2Meta {
  if (
    value.version !== 2 ||
    !value.id ||
    typeof value.title !== 'string' ||
    !Array.isArray(value.tagIds) ||
    !value.createdAt ||
    !value.updatedAt
  ) {
    throw new Error('La metadata de la nota v2 no es válida.')
  }
  return value
}

function validateFolder(value: FolderV2Record): FolderV2Record {
  if (
    value.version !== 2 ||
    !value.id ||
    !value.name ||
    !value.icon ||
    !Number.isSafeInteger(value.gradientIndex)
  ) {
    throw new Error('La carpeta v2 no es válida.')
  }
  return value
}

function validateTag(value: TagV2Record): TagV2Record {
  if (value.version !== 2 || !value.id || !value.name || !/^#[0-9a-f]{6}$/i.test(value.color)) {
    throw new Error('La etiqueta v2 no es válida.')
  }
  return value
}

export async function loadRebuildWorkspace(): Promise<RebuildWorkspaceSnapshot> {
  const [noteRecords, folderRecords, tagRecords] = await Promise.all([
    listEncryptedV2Records<NoteV2Meta>(NOTE_V2_META_TYPE),
    listEncryptedV2Records<FolderV2Record>(FOLDER_V2_TYPE),
    listEncryptedV2Records<TagV2Record>(TAG_V2_TYPE),
  ])

  const notes = noteRecords
    .map((record) => validateNoteMeta(record.value))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
  const folders = folderRecords
    .map((record) => validateFolder(record.value))
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
  const tags = tagRecords
    .map((record) => validateTag(record.value))
    .sort((left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }))

  return { notes, folders, tags }
}

export async function createRebuildNote(folderId: string | null = null): Promise<{
  meta: NoteV2Meta
  body: NoteV2Body
}> {
  const now = new Date().toISOString()
  const id = createId()
  const meta: NoteV2Meta = {
    version: 2,
    id,
    title: 'Nota nueva',
    folderId,
    tagIds: [],
    createdAt: now,
    updatedAt: now,
  }
  const body: NoteV2Body = {
    version: 2,
    noteId: id,
    format: 'plain-text-v1',
    text: '',
  }

  await writeEncryptedV2Records([
    { recordType: NOTE_V2_META_TYPE, recordId: id, value: meta },
    { recordType: NOTE_V2_BODY_TYPE, recordId: id, value: body },
  ])

  return { meta, body }
}

export async function readRebuildNote(noteId: string): Promise<{
  meta: NoteV2Meta
  body: NoteV2Body
}> {
  const [meta, body] = await Promise.all([
    readEncryptedV2Record<NoteV2Meta>(NOTE_V2_META_TYPE, noteId),
    readEncryptedV2Record<NoteV2Body>(NOTE_V2_BODY_TYPE, noteId),
  ])

  if (!meta || !body || body.noteId !== noteId || body.format !== 'plain-text-v1') {
    throw new Error('La nota no existe o está incompleta.')
  }

  return { meta: validateNoteMeta(meta), body }
}

export async function saveRebuildNote(
  existing: NoteV2Meta,
  title: string,
  text: string,
): Promise<NoteV2Meta> {
  const updatedAt = new Date().toISOString()
  const normalizedTitle = title.trim().slice(0, 160) || 'Nota nueva'
  const meta: NoteV2Meta = {
    ...existing,
    title: normalizedTitle,
    updatedAt,
  }
  const body: NoteV2Body = {
    version: 2,
    noteId: existing.id,
    format: 'plain-text-v1',
    text,
  }

  await writeEncryptedV2Records([
    { recordType: NOTE_V2_META_TYPE, recordId: existing.id, value: meta },
    { recordType: NOTE_V2_BODY_TYPE, recordId: existing.id, value: body },
  ])

  return meta
}

export async function createRebuildFolder(name: string): Promise<FolderV2Record> {
  const now = new Date().toISOString()
  const id = createId()
  const folder: FolderV2Record = {
    version: 2,
    id,
    name: normalizeName(name, 60, 'Escribe un nombre para la carpeta.'),
    icon: V2_FOLDER_ICONS[secureRandomIndex(V2_FOLDER_ICONS.length)],
    gradientIndex: secureRandomIndex(V2_FOLDER_GRADIENTS.length),
    createdAt: now,
    updatedAt: now,
  }

  await writeEncryptedV2Record(FOLDER_V2_TYPE, id, folder)
  return folder
}

export async function createRebuildTag(name: string): Promise<TagV2Record> {
  const now = new Date().toISOString()
  const id = createId()
  const color = V2_FOLDER_GRADIENTS[secureRandomIndex(V2_FOLDER_GRADIENTS.length)][0]
  const tag: TagV2Record = {
    version: 2,
    id,
    name: normalizeName(name, 40, 'Escribe un nombre para la etiqueta.'),
    color,
    createdAt: now,
    updatedAt: now,
  }

  await writeEncryptedV2Record(TAG_V2_TYPE, id, tag)
  return tag
}
