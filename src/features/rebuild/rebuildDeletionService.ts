import {
  applyEncryptedV2Changes,
  listEncryptedV2Records,
  readEncryptedV2Record,
  readEncryptedV2Records,
  type EncryptedV2RecordIdentity,
  type EncryptedV2Write,
} from '../../storage/repositories/encryptedV2RecordRepository'
import { blockIdentity } from './incrementalNoteBlocks'
import { createPendingSyncWrite, textChunkIdentity } from './incrementalNoteText'
import {
  FOLDER_V2_TYPE,
  NOTE_V2_BLOCK_MANIFEST_TYPE,
  NOTE_V2_BODY_TYPE,
  NOTE_V2_MANIFEST_TYPE,
  NOTE_V2_META_TYPE,
  TAG_V2_TYPE,
  type FolderV2Record,
  type NoteV2BlockManifest,
  type NoteV2BlockRecord,
  type NoteV2Body,
  type NoteV2Manifest,
  type NoteV2Meta,
} from './rebuildModel'
import { FOLDER_V2_COVER_TYPE } from './workspaceCoverService'

function nextNoteRevision(note: NoteV2Meta): number {
  return (Number.isSafeInteger(note.revision) && note.revision > 0 ? note.revision : 1) + 1
}

function metadataUpdateWrite(meta: NoteV2Meta, queuedAt: string): EncryptedV2Write[] {
  return [
    { recordType: NOTE_V2_META_TYPE, recordId: meta.id, value: meta },
    createPendingSyncWrite(
      meta.id,
      NOTE_V2_META_TYPE,
      meta.id,
      meta.revision,
      'upsert',
      queuedAt,
    ),
  ]
}

export async function deleteRebuildFolder(folderId: string): Promise<NoteV2Meta[]> {
  const [folder, noteRecords] = await Promise.all([
    readEncryptedV2Record<FolderV2Record>(FOLDER_V2_TYPE, folderId),
    listEncryptedV2Records<NoteV2Meta>(NOTE_V2_META_TYPE),
  ])
  const queuedAt = new Date().toISOString()
  const affected = noteRecords
    .map((record) => record.value)
    .filter((note) => note.folderId === folderId)
    .map((note) => ({
      ...note,
      revision: nextNoteRevision(note),
      folderId: null,
      updatedAt: queuedAt,
    }))

  const writes = affected.flatMap((meta) => metadataUpdateWrite(meta, queuedAt))
  const deletes: EncryptedV2RecordIdentity[] = [
    { recordType: FOLDER_V2_TYPE, recordId: folderId },
  ]
  if (folder?.coverAssetId) {
    deletes.push({ recordType: FOLDER_V2_COVER_TYPE, recordId: folder.coverAssetId })
  }

  await applyEncryptedV2Changes({ writes, deletes })
  return affected
}

export async function deleteRebuildTag(tagId: string): Promise<NoteV2Meta[]> {
  const noteRecords = await listEncryptedV2Records<NoteV2Meta>(NOTE_V2_META_TYPE)
  const queuedAt = new Date().toISOString()
  const affected = noteRecords
    .map((record) => record.value)
    .filter((note) => note.tagIds.includes(tagId))
    .map((note) => ({
      ...note,
      revision: nextNoteRevision(note),
      tagIds: note.tagIds.filter((id) => id !== tagId),
      updatedAt: queuedAt,
    }))

  await applyEncryptedV2Changes({
    writes: affected.flatMap((meta) => metadataUpdateWrite(meta, queuedAt)),
    deletes: [{ recordType: TAG_V2_TYPE, recordId: tagId }],
  })
  return affected
}

export async function deleteRebuildNote(noteId: string): Promise<void> {
  const [meta, body, manifest, blockManifest] = await Promise.all([
    readEncryptedV2Record<NoteV2Meta>(NOTE_V2_META_TYPE, noteId),
    readEncryptedV2Record<NoteV2Body>(NOTE_V2_BODY_TYPE, noteId),
    readEncryptedV2Record<NoteV2Manifest>(NOTE_V2_MANIFEST_TYPE, noteId),
    readEncryptedV2Record<NoteV2BlockManifest>(NOTE_V2_BLOCK_MANIFEST_TYPE, noteId),
  ])
  const validBlockIds = blockManifest?.version === 2
    && blockManifest.noteId === noteId
    && blockManifest.format === 'blocks-v1'
    && Array.isArray(blockManifest.blockIds)
    ? blockManifest.blockIds
    : []
  const blockRecords = validBlockIds.length > 0
    ? await readEncryptedV2Records<NoteV2BlockRecord>(
        validBlockIds.map((blockId) => blockIdentity(noteId, blockId)),
      )
    : []

  const queuedAt = new Date().toISOString()
  const writes: EncryptedV2Write[] = []
  const deletes: EncryptedV2RecordIdentity[] = [
    { recordType: NOTE_V2_META_TYPE, recordId: noteId },
  ]

  if (meta) {
    writes.push(createPendingSyncWrite(
      noteId,
      NOTE_V2_META_TYPE,
      noteId,
      nextNoteRevision(meta),
      'delete',
      queuedAt,
    ))
  }

  if (body) {
    deletes.push({ recordType: NOTE_V2_BODY_TYPE, recordId: noteId })
    writes.push(createPendingSyncWrite(
      noteId,
      NOTE_V2_BODY_TYPE,
      noteId,
      meta ? nextNoteRevision(meta) : 1,
      'delete',
      queuedAt,
    ))
  }

  if (manifest?.version === 2 && manifest.noteId === noteId && Array.isArray(manifest.chunks)) {
    deletes.push({ recordType: NOTE_V2_MANIFEST_TYPE, recordId: noteId })
    writes.push(createPendingSyncWrite(
      noteId,
      NOTE_V2_MANIFEST_TYPE,
      noteId,
      Math.max(1, manifest.revision) + 1,
      'delete',
      queuedAt,
    ))

    for (const chunk of manifest.chunks) {
      const identity = textChunkIdentity(noteId, chunk.id)
      deletes.push(identity)
      writes.push(createPendingSyncWrite(
        noteId,
        identity.recordType,
        identity.recordId,
        Math.max(1, chunk.revision) + 1,
        'delete',
        queuedAt,
      ))
    }
  }

  if (blockManifest?.version === 2 && blockManifest.noteId === noteId && blockManifest.format === 'blocks-v1') {
    deletes.push({ recordType: NOTE_V2_BLOCK_MANIFEST_TYPE, recordId: noteId })
    writes.push(createPendingSyncWrite(
      noteId,
      NOTE_V2_BLOCK_MANIFEST_TYPE,
      noteId,
      Math.max(1, blockManifest.revision) + 1,
      'delete',
      queuedAt,
    ))

    validBlockIds.forEach((blockId, index) => {
      const identity = blockIdentity(noteId, blockId)
      const revision = blockRecords[index]?.revision ?? 1
      deletes.push(identity)
      writes.push(createPendingSyncWrite(
        noteId,
        identity.recordType,
        identity.recordId,
        Math.max(1, revision) + 1,
        'delete',
        queuedAt,
      ))
    })
  }

  await applyEncryptedV2Changes({ writes, deletes })
}
