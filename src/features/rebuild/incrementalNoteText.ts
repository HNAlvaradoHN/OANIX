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
    const preferredEnd = Math.min(offset + TARGET_CHUNK_CHARS, text.length)
    const maxEnd = Math.min(offset + MAX_CHUNK_CHARS, text.length)
    const minEnd = Math.min(offset + MIN_CHUNK_CHARS, text.length)
    const newline = text.lastIndexOf('\n', maxEnd)
    const end = newline >= minEnd ? newline + 1 : preferredEnd

    chunks.push(text.slice(offset, end))
    offset = end
  }

  if (offset < text.length) {
    chunks.push(text.slice(offset))
  }

  return chunks
}

function commonPrefixLength(left: string, right: string): number {
  const limit = Math.min(left.length, right.length)
  let index = 0
  while (index < limit && left.charCodeAt(index) === right.charCodeAt(index)) {
    index += 1
  }
  return index
}

function commonSuffixLength(left: string, right: string, prefixLength: number): number {
  const max = Math.min(left.length, right.length) - prefixLength
  let suffix = 0
  while (
    suffix < max
    && left.charCodeAt(left.length - 1 - suffix) === right.charCodeAt(right.length - 1 - suffix)
  ) {
    suffix += 1
  }
  return suffix
}

function chunkBoundaries(chunks: NoteV2TextChunkRef[]): number[] {
  const boundaries = [0]
  for (const chunk of chunks) {
    boundaries.push(boundaries[boundaries.length - 1] + chunk.length)
  }
  return boundaries
}

function chunkIndexForOffset(
  boundaries: number[],
  offset: number,
): number {
  const chunkCount = boundaries.length - 1
  if (chunkCount <= 0) return -1
  if (offset >= boundaries[chunkCount]) return chunkCount - 1

  let low = 0
  let high = chunkCount - 1
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if (offset < boundaries[middle]) {
      high = middle - 1
    } else if (offset >= boundaries[middle + 1]) {
      low = middle + 1
    } else {
      return middle
    }
  }

  return Math.max(0, Math.min(chunkCount - 1, low))
}

function validateManifestTextLength(manifest: NoteV2Manifest, text: string) {
  const total = manifest.chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  if (total !== text.length) {
    throw new Error('El manifiesto incremental no coincide con el texto abierto.')
  }
}

export function createEmptyManifest(noteId: string): NoteV2Manifest {
  return {
    version: 2,
    noteId,
    format: 'chunked-text-v1',
    revision: 1,
    chunks: [],
  }
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
  validateManifestTextLength(manifest, previousText)

  if (previousText === nextText) {
    return { manifest, writes: [], deletes: [] }
  }

  if (manifest.chunks.length === 0) {
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
          return {
            ...write,
            value: { ...pending, revision: updatedManifest.revision },
          }
        }
      }
      return write
    })
    return { manifest: updatedManifest, writes, deletes: [] }
  }

  const prefix = commonPrefixLength(previousText, nextText)
  const suffix = commonSuffixLength(previousText, nextText, prefix)
  const oldChangedEnd = previousText.length - suffix
  const boundaries = chunkBoundaries(manifest.chunks)

  let first = chunkIndexForOffset(boundaries, prefix)
  let last = oldChangedEnd > prefix
    ? chunkIndexForOffset(boundaries, oldChangedEnd - 1)
    : first

  first = Math.max(0, first - 1)
  last = Math.min(manifest.chunks.length - 1, last + 1)

  const windowStart = boundaries[first]
  const windowEnd = boundaries[last + 1]
  const suffixOutsideLength = previousText.length - windowEnd
  const nextWindowEnd = nextText.length - suffixOutsideLength
  const nextWindow = nextText.slice(windowStart, nextWindowEnd)
  const nextPieces = splitText(nextWindow)

  const oldRefs = manifest.chunks.slice(first, last + 1)
  const oldPieces = oldRefs.map((_, index) =>
    previousText.slice(boundaries[first + index], boundaries[first + index + 1]),
  )

  let stablePrefixCount = 0
  while (
    stablePrefixCount < oldPieces.length
    && stablePrefixCount < nextPieces.length
    && oldPieces[stablePrefixCount] === nextPieces[stablePrefixCount]
  ) {
    stablePrefixCount += 1
  }

  let stableSuffixCount = 0
  while (
    stableSuffixCount < oldPieces.length - stablePrefixCount
    && stableSuffixCount < nextPieces.length - stablePrefixCount
    && oldPieces[oldPieces.length - 1 - stableSuffixCount]
      === nextPieces[nextPieces.length - 1 - stableSuffixCount]
  ) {
    stableSuffixCount += 1
  }

  const oldMiddleStart = stablePrefixCount
  const oldMiddleEnd = oldRefs.length - stableSuffixCount
  const nextMiddleStart = stablePrefixCount
  const nextMiddleEnd = nextPieces.length - stableSuffixCount
  const oldMiddle = oldRefs.slice(oldMiddleStart, oldMiddleEnd)
  const nextMiddle = nextPieces.slice(nextMiddleStart, nextMiddleEnd)

  const replacementRefs: NoteV2TextChunkRef[] = [
    ...oldRefs.slice(0, stablePrefixCount),
  ]
  const writes: EncryptedV2Write[] = []
  const deletes: EncryptedV2RecordIdentity[] = []

  nextMiddle.forEach((piece, index) => {
    const previous = oldMiddle[index]
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

    replacementRefs.push({ id: chunkId, length: piece.length, revision })
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

  for (let index = nextMiddle.length; index < oldMiddle.length; index += 1) {
    const removed = oldMiddle[index]
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

  if (stableSuffixCount > 0) {
    replacementRefs.push(...oldRefs.slice(oldRefs.length - stableSuffixCount))
  }

  const updatedManifest: NoteV2Manifest = {
    ...manifest,
    revision: manifest.revision + 1,
    chunks: [
      ...manifest.chunks.slice(0, first),
      ...replacementRefs,
      ...manifest.chunks.slice(last + 1),
    ],
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
