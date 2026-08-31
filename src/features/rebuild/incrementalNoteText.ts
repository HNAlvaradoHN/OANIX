import type {
  NoteV2Manifest,
  NoteV2TextChunk,
  NoteV2TextChunkRef,
  SyncV2PendingRecord,
} from './rebuildModel'
import {
  NOTE_V2_MANIFEST_TYPE,
  NOTE_V2_TEXT_CHUNK_TYPE,
  SYNC_V2_PENDING_TYPE,
} from './rebuildModel'
import type {
  EncryptedV2RecordIdentity,
  EncryptedV2Write,
} from '../../storage/repositories/encryptedV2RecordRepository'

const TARGET_CHUNK_CHARS = 16 * 1024
const MIN_CHUNK_CHARS = 8 * 1024
const MAX_CHUNK_CHARS = 24 * 1024
const RESYNC_LOOKAHEAD_CHUNKS = 32

export interface IncrementalTextMutation {
  manifest: NoteV2Manifest
  writes: EncryptedV2Write[]
  deletes: EncryptedV2RecordIdentity[]
}

function chunkRecordId(noteId: string, chunkId: string): string {
  return `${noteId}:${chunkId}`
}

function pendingRecordId(unitType: string, unitId: string): string {
  return JSON.stringify([unitType, unitId])
}

export function createPendingSyncWrite(
  noteId: string,
  unitType: string,
  unitId: string,
  revision: number,
  operation: 'upsert' | 'delete',
  queuedAt: string,
): EncryptedV2Write<SyncV2PendingRecord> {
  return {
    recordType: SYNC_V2_PENDING_TYPE,
    recordId: pendingRecordId(unitType, unitId),
    value: {
      version: 2,
      noteId,
      unitType,
      unitId,
      revision,
      operation,
      queuedAt,
    },
  }
}

function splitText(text: string): string[] {
  if (!text) return []

  const chunks: string[] = []
  let offset = 0

  while (text.length - offset > MAX_CHUNK_CHARS) {
    const preferredEnd = offset + TARGET_CHUNK_CHARS
    const maxEnd = Math.min(offset + MAX_CHUNK_CHARS, text.length)
    const minEnd = offset + MIN_CHUNK_CHARS
    const newline = text.lastIndexOf('\n', maxEnd)
    const newlineEnd = newline + 1
    const leavesUsefulTail = text.length - newlineEnd >= MIN_CHUNK_CHARS
    const end = newline >= minEnd && leavesUsefulTail ? newlineEnd : preferredEnd

    chunks.push(text.slice(offset, end))
    offset = end
  }

  if (offset < text.length) {
    chunks.push(text.slice(offset))
  }

  return chunks
}

function manifestPieces(manifest: NoteV2Manifest, text: string): string[] {
  const pieces: string[] = []
  let offset = 0

  for (const chunk of manifest.chunks) {
    const end = offset + chunk.length
    pieces.push(text.slice(offset, end))
    offset = end
  }

  if (offset !== text.length) {
    throw new Error('El manifiesto incremental no coincide con el texto abierto.')
  }

  return pieces
}

function findResyncAnchor(
  oldPieces: string[],
  oldIndex: number,
  nextText: string,
  newOffset: number,
): { oldIndex: number; position: number } | null {
  const end = Math.min(oldPieces.length, oldIndex + RESYNC_LOOKAHEAD_CHUNKS)
  let best: { oldIndex: number; position: number; strong: boolean } | null = null

  for (let index = oldIndex; index < end; index += 1) {
    const piece = oldPieces[index]
    if (!piece) continue

    const position = nextText.indexOf(piece, newOffset)
    if (position < 0) continue

    const following = oldPieces[index + 1]
    const strong = !following || nextText.startsWith(following, position + piece.length)

    if (
      !best
      || position < best.position
      || (position === best.position && strong && !best.strong)
      || (position === best.position && strong === best.strong && index < best.oldIndex)
    ) {
      best = { oldIndex: index, position, strong }
    }
  }

  if (best) return { oldIndex: best.oldIndex, position: best.position }

  // A very large paste/replacement can span more than the local lookahead.
  // Probe exponentially farther anchors so unchanged tails are not rewritten wholesale.
  let distance = RESYNC_LOOKAHEAD_CHUNKS * 2
  while (oldIndex + distance < oldPieces.length) {
    const index = oldIndex + distance
    const position = nextText.indexOf(oldPieces[index], newOffset)
    if (position >= 0) return { oldIndex: index, position }
    distance *= 2
  }

  const lastIndex = oldPieces.length - 1
  if (lastIndex >= oldIndex + RESYNC_LOOKAHEAD_CHUNKS) {
    const position = nextText.lastIndexOf(oldPieces[lastIndex])
    if (position >= newOffset) return { oldIndex: lastIndex, position }
  }

  return null
}

export function buildInitialIncrementalText(
  noteId: string,
  text: string,
  queuedAt: string,
  createId: () => string,
): IncrementalTextMutation {
  const pieces = splitText(text)
  const refs: NoteV2TextChunkRef[] = []
  const writes: EncryptedV2Write[] = []

  for (const piece of pieces) {
    const chunkId = createId()
    const revision = 1
    const unitId = chunkRecordId(noteId, chunkId)
    const chunk: NoteV2TextChunk = {
      version: 2,
      noteId,
      chunkId,
      revision,
      text: piece,
    }
    refs.push({ id: chunkId, length: piece.length, revision })
    writes.push(
      { recordType: NOTE_V2_TEXT_CHUNK_TYPE, recordId: unitId, value: chunk },
      createPendingSyncWrite(noteId, NOTE_V2_TEXT_CHUNK_TYPE, unitId, revision, 'upsert', queuedAt),
    )
  }

  const manifest: NoteV2Manifest = {
    version: 2,
    noteId,
    format: 'chunked-text-v1',
    revision: 1,
    chunks: refs,
  }

  writes.push(
    { recordType: NOTE_V2_MANIFEST_TYPE, recordId: noteId, value: manifest },
    createPendingSyncWrite(noteId, NOTE_V2_MANIFEST_TYPE, noteId, manifest.revision, 'upsert', queuedAt),
  )

  return { manifest, writes, deletes: [] }
}

export function buildIncrementalTextUpdate(
  manifest: NoteV2Manifest,
  previousText: string,
  nextText: string,
  queuedAt: string,
  createId: () => string,
): IncrementalTextMutation {
  if (previousText === nextText) {
    return { manifest, writes: [], deletes: [] }
  }

  const oldPieces = manifestPieces(manifest, previousText)
  if (oldPieces.length === 0) {
    const initial = buildInitialIncrementalText(manifest.noteId, nextText, queuedAt, createId)
    const updatedManifest: NoteV2Manifest = {
      ...initial.manifest,
      revision: manifest.revision + 1,
    }
    const writes = initial.writes.map((write) => {
      if (write.recordType === NOTE_V2_MANIFEST_TYPE && write.recordId === manifest.noteId) {
        return { ...write, value: updatedManifest }
      }
      if (write.recordType === SYNC_V2_PENDING_TYPE) {
        const pending = write.value as SyncV2PendingRecord
        if (pending.unitType === NOTE_V2_MANIFEST_TYPE && pending.unitId === manifest.noteId) {
          return { ...write, value: { ...pending, revision: updatedManifest.revision } }
        }
      }
      return write
    })
    return { manifest: updatedManifest, writes, deletes: [] }
  }

  const writes: EncryptedV2Write[] = []
  const deletes: EncryptedV2RecordIdentity[] = []
  const nextRefs: NoteV2TextChunkRef[] = []

  const writeChangedSegment = (
    fromOldIndex: number,
    toOldIndex: number,
    text: string,
  ) => {
    const replacedRefs = manifest.chunks.slice(fromOldIndex, toOldIndex)
    const pieces = splitText(text)

    pieces.forEach((piece, index) => {
      const previous = replacedRefs[index]
      const chunkId = previous?.id ?? createId()
      const revision = previous ? previous.revision + 1 : 1
      const unitId = chunkRecordId(manifest.noteId, chunkId)
      const chunk: NoteV2TextChunk = {
        version: 2,
        noteId: manifest.noteId,
        chunkId,
        revision,
        text: piece,
      }

      nextRefs.push({ id: chunkId, length: piece.length, revision })
      writes.push(
        { recordType: NOTE_V2_TEXT_CHUNK_TYPE, recordId: unitId, value: chunk },
        createPendingSyncWrite(
          manifest.noteId,
          NOTE_V2_TEXT_CHUNK_TYPE,
          unitId,
          revision,
          'upsert',
          queuedAt,
        ),
      )
    })

    for (let index = pieces.length; index < replacedRefs.length; index += 1) {
      const removed = replacedRefs[index]
      const unitId = chunkRecordId(manifest.noteId, removed.id)
      deletes.push({ recordType: NOTE_V2_TEXT_CHUNK_TYPE, recordId: unitId })
      writes.push(createPendingSyncWrite(
        manifest.noteId,
        NOTE_V2_TEXT_CHUNK_TYPE,
        unitId,
        removed.revision + 1,
        'delete',
        queuedAt,
      ))
    }
  }

  let oldIndex = 0
  let newOffset = 0

  while (oldIndex < oldPieces.length) {
    const piece = oldPieces[oldIndex]

    if (nextText.startsWith(piece, newOffset)) {
      const end = newOffset + piece.length
      const trailingInsertion = oldIndex === oldPieces.length - 1
        ? nextText.length - end
        : 0

      if (trailingInsertion > 0 && trailingInsertion < MIN_CHUNK_CHARS) {
        writeChangedSegment(oldIndex, oldIndex + 1, nextText.slice(newOffset))
        oldIndex += 1
        newOffset = nextText.length
        continue
      }

      nextRefs.push(manifest.chunks[oldIndex])
      newOffset = end
      oldIndex += 1
      continue
    }

    const anchor = findResyncAnchor(oldPieces, oldIndex, nextText, newOffset)
    if (!anchor) {
      writeChangedSegment(oldIndex, oldPieces.length, nextText.slice(newOffset))
      oldIndex = oldPieces.length
      newOffset = nextText.length
      break
    }

    if (
      anchor.oldIndex === oldIndex
      && anchor.position > newOffset
      && anchor.position - newOffset < MIN_CHUNK_CHARS
    ) {
      const end = anchor.position + oldPieces[anchor.oldIndex].length
      writeChangedSegment(oldIndex, oldIndex + 1, nextText.slice(newOffset, end))
      oldIndex += 1
      newOffset = end
      continue
    }

    writeChangedSegment(oldIndex, anchor.oldIndex, nextText.slice(newOffset, anchor.position))
    nextRefs.push(manifest.chunks[anchor.oldIndex])
    newOffset = anchor.position + oldPieces[anchor.oldIndex].length
    oldIndex = anchor.oldIndex + 1
  }

  if (newOffset < nextText.length) {
    writeChangedSegment(oldPieces.length, oldPieces.length, nextText.slice(newOffset))
  }

  const updatedManifest: NoteV2Manifest = {
    ...manifest,
    revision: manifest.revision + 1,
    chunks: nextRefs,
  }

  writes.push(
    { recordType: NOTE_V2_MANIFEST_TYPE, recordId: manifest.noteId, value: updatedManifest },
    createPendingSyncWrite(
      manifest.noteId,
      NOTE_V2_MANIFEST_TYPE,
      manifest.noteId,
      updatedManifest.revision,
      'upsert',
      queuedAt,
    ),
  )

  return { manifest: updatedManifest, writes, deletes }
}

export function textChunkIdentity(noteId: string, chunkId: string): EncryptedV2RecordIdentity {
  return {
    recordType: NOTE_V2_TEXT_CHUNK_TYPE,
    recordId: chunkRecordId(noteId, chunkId),
  }
}
