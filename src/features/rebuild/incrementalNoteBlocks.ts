import type {
  EncryptedV2RecordIdentity,
  EncryptedV2Write,
} from '../../storage/repositories/encryptedV2RecordRepository'
import { createPendingSyncWrite } from './incrementalNoteText'
import {
  NOTE_V2_BLOCK_MANIFEST_TYPE,
  NOTE_V2_BLOCK_TYPE,
  type NoteV2BlockManifest,
  type NoteV2BlockRecord,
  type NoteV2BlockValue,
} from './rebuildModel'

export interface NoteV2BlockDraft {
  blockId: string
  kind: string
  data: { [key: string]: NoteV2BlockValue }
}

export interface IncrementalBlockChangeSet {
  upserts?: NoteV2BlockDraft[]
  deletes?: string[]
  order?: string[]
}

export interface IncrementalBlockMutation {
  manifest: NoteV2BlockManifest | null
  writes: EncryptedV2Write[]
  deletes: EncryptedV2RecordIdentity[]
  changed: boolean
}

function blockRecordId(noteId: string, blockId: string): string {
  return `${noteId}:${blockId}`
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isJsonSafe(value: unknown, depth = 0): value is NoteV2BlockValue {
  if (depth > 32) return false
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every((item) => isJsonSafe(item, depth + 1))
  if (!isPlainObject(value)) return false
  return Object.values(value).every((item) => isJsonSafe(item, depth + 1))
}

function validateBlockDraft(draft: NoteV2BlockDraft) {
  if (!draft.blockId || draft.blockId.length > 180) {
    throw new Error('El identificador del bloque no es válido.')
  }
  if (!draft.kind || draft.kind.length > 80) {
    throw new Error('El tipo de bloque no es válido.')
  }
  if (!isJsonSafe(draft.data)) {
    throw new Error('Los datos del bloque deben ser JSON seguro.')
  }
}

function jsonValueEquals(left: NoteV2BlockValue, right: NoteV2BlockValue): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
    return left.every((item, index) => jsonValueEquals(item, right[index]))
  }
  if (isPlainObject(left) || isPlainObject(right)) {
    if (!isPlainObject(left) || !isPlainObject(right)) return false
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    if (leftKeys.length !== rightKeys.length) return false
    return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key)
      && jsonValueEquals(left[key] as NoteV2BlockValue, right[key] as NoteV2BlockValue))
  }
  return false
}

function blockEquals(existing: NoteV2BlockRecord, draft: NoteV2BlockDraft): boolean {
  return existing.kind === draft.kind && jsonValueEquals(existing.data, draft.data)
}

function sameOrder(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

export function blockIdentity(noteId: string, blockId: string): EncryptedV2RecordIdentity {
  return {
    recordType: NOTE_V2_BLOCK_TYPE,
    recordId: blockRecordId(noteId, blockId),
  }
}

/**
 * Builds one atomic encrypted mutation from dirty block IDs only. Existing payloads
 * are supplied by the caller so unchanged dirty blocks can still be skipped without
 * scanning/decrypting the whole note.
 */
export function buildIncrementalBlockMutation(
  noteId: string,
  manifest: NoteV2BlockManifest | null,
  existingById: ReadonlyMap<string, NoteV2BlockRecord>,
  changes: IncrementalBlockChangeSet,
  queuedAt: string,
): IncrementalBlockMutation {
  const upserts = changes.upserts ?? []
  const requestedDeletes = changes.deletes ?? []
  const upsertIds = new Set<string>()
  const deleteIds = new Set<string>()

  for (const draft of upserts) {
    validateBlockDraft(draft)
    if (upsertIds.has(draft.blockId)) throw new Error('Hay bloques duplicados en la actualización.')
    upsertIds.add(draft.blockId)
  }
  for (const blockId of requestedDeletes) {
    if (!blockId || deleteIds.has(blockId)) throw new Error('Hay eliminaciones de bloque inválidas.')
    if (upsertIds.has(blockId)) throw new Error('Un bloque no puede actualizarse y eliminarse a la vez.')
    deleteIds.add(blockId)
  }

  const writes: EncryptedV2Write[] = []
  const deletes: EncryptedV2RecordIdentity[] = []
  const existingOrder = manifest?.blockIds ?? []
  const currentIds = new Set(existingOrder)
  const realDeletedIds = new Set<string>()
  const newlyAddedIds: string[] = []

  for (const draft of upserts) {
    const existing = existingById.get(draft.blockId)
    if (existing && blockEquals(existing, draft)) continue

    const revision = existing ? existing.revision + 1 : 1
    const recordId = blockRecordId(noteId, draft.blockId)
    const block: NoteV2BlockRecord = {
      version: 2,
      noteId,
      blockId: draft.blockId,
      revision,
      kind: draft.kind,
      data: draft.data,
    }

    writes.push(
      { recordType: NOTE_V2_BLOCK_TYPE, recordId, value: block },
      createPendingSyncWrite(noteId, NOTE_V2_BLOCK_TYPE, recordId, revision, 'upsert', queuedAt),
    )

    if (!currentIds.has(draft.blockId)) newlyAddedIds.push(draft.blockId)
  }

  for (const blockId of requestedDeletes) {
    const existing = existingById.get(blockId)
    if (!existing) continue

    const recordId = blockRecordId(noteId, blockId)
    deletes.push({ recordType: NOTE_V2_BLOCK_TYPE, recordId })
    writes.push(createPendingSyncWrite(
      noteId,
      NOTE_V2_BLOCK_TYPE,
      recordId,
      existing.revision + 1,
      'delete',
      queuedAt,
    ))
    realDeletedIds.add(blockId)
  }

  const defaultOrder = [
    ...existingOrder.filter((id) => !realDeletedIds.has(id)),
    ...newlyAddedIds,
  ]
  const nextOrder = changes.order ?? defaultOrder
  const nextOrderSet = new Set(nextOrder)

  if (nextOrderSet.size !== nextOrder.length) {
    throw new Error('El orden de bloques contiene identificadores duplicados.')
  }
  if (nextOrder.length !== defaultOrder.length
    || defaultOrder.some((id) => !nextOrderSet.has(id))) {
    throw new Error('El orden de bloques debe contener exactamente los bloques existentes.')
  }

  const topologyChanged = !sameOrder(existingOrder, nextOrder)
  let nextManifest = manifest

  if (topologyChanged) {
    nextManifest = {
      version: 2,
      noteId,
      format: 'blocks-v1',
      revision: manifest ? manifest.revision + 1 : 1,
      blockIds: nextOrder,
    }
    writes.push(
      { recordType: NOTE_V2_BLOCK_MANIFEST_TYPE, recordId: noteId, value: nextManifest },
      createPendingSyncWrite(
        noteId,
        NOTE_V2_BLOCK_MANIFEST_TYPE,
        noteId,
        nextManifest.revision,
        'upsert',
        queuedAt,
      ),
    )
  }

  return {
    manifest: nextManifest,
    writes,
    deletes,
    changed: writes.length > 0 || deletes.length > 0,
  }
}
