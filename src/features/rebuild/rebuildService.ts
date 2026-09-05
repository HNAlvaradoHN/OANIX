import {
  applyEncryptedV2Changes,
  listEncryptedV2Records,
  readEncryptedV2Record,
  readEncryptedV2Records,
  writeEncryptedV2Record,
  type EncryptedV2RecordIdentity,
  type EncryptedV2Write,
} from '../../storage/repositories/encryptedV2RecordRepository'
import {
  buildIncrementalTextUpdate,
  buildInitialIncrementalText,
  createPendingSyncWrite,
  textChunkIdentity,
} from './incrementalNoteText'
import {
  FOLDER_V2_TYPE,
  NOTE_V2_BODY_TYPE,
  NOTE_V2_MANIFEST_TYPE,
  NOTE_V2_META_TYPE,
  TAG_V2_TYPE,
  V2_FOLDER_GRADIENTS,
  V2_FOLDER_ICONS,
  type FolderV2Record,
  type NoteV2Body,
  type NoteV2Manifest,
  type NoteV2Meta,
  type NoteV2TextChunk,
  type TagV2Record,
} from './rebuildModel'
import { sortWorkspaceFolders, sortWorkspaceTags } from './workspaceCustomizationService'

export interface RebuildWorkspaceSnapshot {
  notes: NoteV2Meta[]
  folders: FolderV2Record[]
  tags: TagV2Record[]
}

export interface RebuildOpenedNote {
  meta: NoteV2Meta
  text: string
}

export interface RebuildNoteCardCustomization {
  cardColor: string | null
  cardIcon: string | null
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
    (value.order != null && (typeof value.order !== 'number' || !Number.isFinite(value.order))) ||
    (value.folderOrder != null && (
      typeof value.folderOrder !== 'object'
      || !value.folderOrder.folderId
      || typeof value.folderOrder.order !== 'number'
      || !Number.isFinite(value.folderOrder.order)
    )) ||
    (value.cardColor != null && !/^#[0-9a-f]{6}$/i.test(value.cardColor)) ||
    (value.cardIcon != null && (
      typeof value.cardIcon !== 'string'
      || value.cardIcon.trim().length === 0
      || value.cardIcon.length > 16
    )) ||
    !value.createdAt ||
    !value.updatedAt
  ) {
    throw new Error('La metadata de la nota v2 no es válida.')
  }

  const revision = Number.isSafeInteger(value.revision) && value.revision > 0
    ? value.revision
    : 1

  return revision === value.revision ? value : { ...value, revision }
}

function validateManifest(value: NoteV2Manifest, noteId: string): NoteV2Manifest {
  if (
    value.version !== 2 ||
    value.noteId !== noteId ||
    value.format !== 'chunked-text-v1' ||
    !Number.isSafeInteger(value.revision) ||
    value.revision <= 0 ||
    !Array.isArray(value.chunks)
  ) {
    throw new Error('El manifiesto incremental de la nota no es válido.')
  }

  const ids = new Set<string>()
  for (const chunk of value.chunks) {
    if (
      !chunk.id ||
      ids.has(chunk.id) ||
      !Number.isSafeInteger(chunk.length) ||
      chunk.length <= 0 ||
      !Number.isSafeInteger(chunk.revision) ||
      chunk.revision <= 0
    ) {
      throw new Error('El manifiesto incremental contiene un fragmento inválido.')
    }
    ids.add(chunk.id)
  }

  return value
}

function validateFolder(value: FolderV2Record): FolderV2Record {
  if (
    value.version !== 2 ||
    !value.id ||
    !value.name ||
    !value.icon ||
    !Number.isSafeInteger(value.gradientIndex) ||
    (value.customColor != null && !/^#[0-9a-f]{6}$/i.test(value.customColor)) ||
    (value.coverAssetId != null && typeof value.coverAssetId !== 'string') ||
    (value.order != null && (!Number.isSafeInteger(value.order) || value.order < 0))
  ) {
    throw new Error('La carpeta v2 no es válida.')
  }
  return value
}

function validateTag(value: TagV2Record): TagV2Record {
  if (
    value.version !== 2
    || !value.id
    || !value.name
    || !/^#[0-9a-f]{6}$/i.test(value.color)
    || (value.order != null && (!Number.isSafeInteger(value.order) || value.order < 0))
  ) {
    throw new Error('La etiqueta v2 no es válida.')
  }
  return value
}

async function readIncrementalText(manifest: NoteV2Manifest): Promise<string> {
  if (manifest.chunks.length === 0) return ''

  const chunks = await readEncryptedV2Records<NoteV2TextChunk>(
    manifest.chunks.map((chunk) => textChunkIdentity(manifest.noteId, chunk.id)),
  )

  return chunks.map((chunk, index) => {
    const ref = manifest.chunks[index]
    if (
      !chunk ||
      chunk.version !== 2 ||
      chunk.noteId !== manifest.noteId ||
      chunk.chunkId !== ref.id ||
      chunk.revision !== ref.revision ||
      chunk.text.length !== ref.length
    ) {
      throw new Error('La nota incremental está incompleta o dañada.')
    }
    return chunk.text
  }).join('')
}

async function persistNoteMetaUpdate(
  existing: NoteV2Meta,
  patch: Partial<Pick<NoteV2Meta, 'order' | 'folderOrder' | 'cardColor' | 'cardIcon'>>,
): Promise<NoteV2Meta> {
  const queuedAt = new Date().toISOString()
  const meta = validateNoteMeta({
    ...existing,
    ...patch,
    revision: Math.max(1, existing.revision) + 1,
  })

  await applyEncryptedV2Changes({
    writes: [
      { recordType: NOTE_V2_META_TYPE, recordId: existing.id, value: meta },
      createPendingSyncWrite(
        existing.id,
        NOTE_V2_META_TYPE,
        existing.id,
        meta.revision,
        'upsert',
        queuedAt,
      ),
    ],
  })

  return meta
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
  const folders = sortWorkspaceFolders(folderRecords.map((record) => validateFolder(record.value)))
  const tags = sortWorkspaceTags(tagRecords.map((record) => validateTag(record.value)))

  return { notes, folders, tags }
}

export async function createRebuildNote(
  folderId: string | null = null,
  order?: number,
  folderOrder?: number,
): Promise<RebuildOpenedNote> {
  const now = new Date().toISOString()
  const id = createId()
  const createdAtMs = Date.parse(now)
  const meta: NoteV2Meta = {
    version: 2,
    revision: 1,
    id,
    title: '',
    folderId,
    tagIds: [],
    order: typeof order === 'number' && Number.isFinite(order) ? order : -createdAtMs,
    ...(folderId
      ? {
          folderOrder: {
            folderId,
            order: typeof folderOrder === 'number' && Number.isFinite(folderOrder)
              ? folderOrder
              : -createdAtMs,
          },
        }
      : {}),
    cardColor: null,
    cardIcon: null,
    createdAt: now,
    updatedAt: now,
  }
  const textMutation = buildInitialIncrementalText(id, '', now, createId)

  await applyEncryptedV2Changes({
    writes: [
      { recordType: NOTE_V2_META_TYPE, recordId: id, value: meta },
      createPendingSyncWrite(id, NOTE_V2_META_TYPE, id, meta.revision, 'upsert', now),
      ...textMutation.writes,
    ],
  })

  return { meta, text: '' }
}

export async function readRebuildNote(noteId: string): Promise<RebuildOpenedNote> {
  const [rawMeta, rawManifest] = await Promise.all([
    readEncryptedV2Record<NoteV2Meta>(NOTE_V2_META_TYPE, noteId),
    readEncryptedV2Record<NoteV2Manifest>(NOTE_V2_MANIFEST_TYPE, noteId),
  ])

  if (!rawMeta) {
    throw new Error('La nota no existe o está incompleta.')
  }

  const meta = validateNoteMeta(rawMeta)
  if (rawManifest) {
    const manifest = validateManifest(rawManifest, noteId)
    return { meta, text: await readIncrementalText(manifest) }
  }

  // Transitional fallback: notes created before the incremental format remain readable.
  // The first body edit migrates them without deleting the legacy record.
  const body = await readEncryptedV2Record<NoteV2Body>(NOTE_V2_BODY_TYPE, noteId)
  if (!body || body.noteId !== noteId || body.format !== 'plain-text-v1') {
    throw new Error('La nota no existe o está incompleta.')
  }

  return { meta, text: body.text }
}

export async function saveRebuildNote(
  existing: NoteV2Meta,
  previousText: string,
  title: string,
  text: string,
): Promise<NoteV2Meta> {
  const normalizedTitle = title.trim().slice(0, 160)
  const titleChanged = normalizedTitle !== existing.title
  const textChanged = text !== previousText

  if (!titleChanged && !textChanged) return existing

  const queuedAt = new Date().toISOString()
  const meta: NoteV2Meta = {
    ...existing,
    revision: Math.max(1, existing.revision) + 1,
    title: normalizedTitle,
    updatedAt: queuedAt,
  }
  const writes: EncryptedV2Write[] = [
    { recordType: NOTE_V2_META_TYPE, recordId: existing.id, value: meta },
    createPendingSyncWrite(
      existing.id,
      NOTE_V2_META_TYPE,
      existing.id,
      meta.revision,
      'upsert',
      queuedAt,
    ),
  ]
  const deletes: EncryptedV2RecordIdentity[] = []

  if (textChanged) {
    const rawManifest = await readEncryptedV2Record<NoteV2Manifest>(
      NOTE_V2_MANIFEST_TYPE,
      existing.id,
    )
    const textMutation = rawManifest
      ? buildIncrementalTextUpdate(
          validateManifest(rawManifest, existing.id),
          previousText,
          text,
          queuedAt,
          createId,
        )
      : buildInitialIncrementalText(existing.id, text, queuedAt, createId)

    writes.push(...textMutation.writes)
    deletes.push(...textMutation.deletes)
  }

  await applyEncryptedV2Changes({ writes, deletes })
  return meta
}

export async function saveRebuildNoteCard(
  existing: NoteV2Meta,
  input: RebuildNoteCardCustomization,
): Promise<NoteV2Meta> {
  const cardColor = input.cardColor?.trim() || null
  const cardIcon = input.cardIcon?.trim() || null
  if (cardColor && !/^#[0-9a-f]{6}$/i.test(cardColor)) {
    throw new Error('El color de la tarjeta no es válido.')
  }
  if (cardIcon && cardIcon.length > 16) {
    throw new Error('El icono de la nota no es válido.')
  }
  if (cardColor === (existing.cardColor ?? null) && cardIcon === (existing.cardIcon ?? null)) {
    return existing
  }
  return persistNoteMetaUpdate(existing, { cardColor, cardIcon })
}

export async function saveRebuildNoteOrder(existing: NoteV2Meta, order: number): Promise<NoteV2Meta> {
  if (!Number.isFinite(order)) throw new Error('La posición de la nota no es válida.')
  if (existing.order === order) return existing
  return persistNoteMetaUpdate(existing, { order })
}

export async function saveRebuildNoteFolderOrder(
  existing: NoteV2Meta,
  folderId: string,
  order: number,
): Promise<NoteV2Meta> {
  if (!folderId || existing.folderId !== folderId) {
    throw new Error('La nota ya no pertenece a esta carpeta.')
  }
  if (!Number.isFinite(order)) throw new Error('La posición de la nota en la carpeta no es válida.')
  if (existing.folderOrder?.folderId === folderId && existing.folderOrder.order === order) {
    return existing
  }
  return persistNoteMetaUpdate(existing, { folderOrder: { folderId, order } })
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
    customColor: null,
    coverAssetId: null,
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
