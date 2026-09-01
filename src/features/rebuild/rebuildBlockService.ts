import {
  applyEncryptedV2Changes,
  readEncryptedV2Record,
  readEncryptedV2Records,
} from '../../storage/repositories/encryptedV2RecordRepository'
import {
  blockIdentity,
  buildIncrementalBlockMutation,
  type IncrementalBlockChangeSet,
} from './incrementalNoteBlocks'
import {
  NOTE_V2_BLOCK_MANIFEST_TYPE,
  type NoteV2BlockManifest,
  type NoteV2BlockRecord,
  type NoteV2BlockValue,
} from './rebuildModel'

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

function validateBlockManifest(
  value: NoteV2BlockManifest,
  noteId: string,
): NoteV2BlockManifest {
  if (
    value.version !== 2
    || value.noteId !== noteId
    || value.format !== 'blocks-v1'
    || !Number.isSafeInteger(value.revision)
    || value.revision <= 0
    || !Array.isArray(value.blockIds)
    || value.blockIds.some((id) => !id)
    || new Set(value.blockIds).size !== value.blockIds.length
  ) {
    throw new Error('El manifiesto de bloques de la nota no es válido.')
  }
  return value
}

function validateBlockRecord(
  value: NoteV2BlockRecord,
  noteId: string,
  blockId: string,
): NoteV2BlockRecord {
  if (
    value.version !== 2
    || value.noteId !== noteId
    || value.blockId !== blockId
    || !Number.isSafeInteger(value.revision)
    || value.revision <= 0
    || !value.kind
    || !isJsonSafe(value.data)
  ) {
    throw new Error('Un bloque cifrado de la nota no es válido.')
  }
  return value
}

export async function readRebuildBlocks(noteId: string): Promise<NoteV2BlockRecord[]> {
  const rawManifest = await readEncryptedV2Record<NoteV2BlockManifest>(
    NOTE_V2_BLOCK_MANIFEST_TYPE,
    noteId,
  )
  if (!rawManifest) return []

  const manifest = validateBlockManifest(rawManifest, noteId)
  if (manifest.blockIds.length === 0) return []

  const blocks = await readEncryptedV2Records<NoteV2BlockRecord>(
    manifest.blockIds.map((blockId) => blockIdentity(noteId, blockId)),
  )

  return blocks.map((block, index) => {
    const blockId = manifest.blockIds[index]
    if (!block) throw new Error('La nota contiene una referencia a un bloque inexistente.')
    return validateBlockRecord(block, noteId, blockId)
  })
}

/**
 * Persists only dirty block IDs. The full block collection is never scanned or
 * re-encrypted for a single-block edit, and a no-op produces no IndexedDB write.
 */
export async function saveRebuildBlocks(
  noteId: string,
  changes: IncrementalBlockChangeSet,
): Promise<NoteV2BlockManifest | null> {
  const rawManifest = await readEncryptedV2Record<NoteV2BlockManifest>(
    NOTE_V2_BLOCK_MANIFEST_TYPE,
    noteId,
  )
  const manifest = rawManifest ? validateBlockManifest(rawManifest, noteId) : null

  const affectedIds = Array.from(new Set([
    ...(changes.upserts ?? []).map((block) => block.blockId),
    ...(changes.deletes ?? []),
  ]))
  const existingValues = await readEncryptedV2Records<NoteV2BlockRecord>(
    affectedIds.map((blockId) => blockIdentity(noteId, blockId)),
  )
  const existingById = new Map<string, NoteV2BlockRecord>()

  affectedIds.forEach((blockId, index) => {
    const value = existingValues[index]
    if (!value) return
    existingById.set(blockId, validateBlockRecord(value, noteId, blockId))
  })

  const mutation = buildIncrementalBlockMutation(
    noteId,
    manifest,
    existingById,
    changes,
    new Date().toISOString(),
  )

  if (!mutation.changed) return manifest
  await applyEncryptedV2Changes({ writes: mutation.writes, deletes: mutation.deletes })
  return mutation.manifest
}
