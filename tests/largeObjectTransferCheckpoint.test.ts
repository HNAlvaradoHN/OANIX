import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MemorySingleLargeObjectChunkRetention,
  advanceLargeObjectTransferCheckpoint,
  createLargeObjectTransferCheckpoint,
  isLargeObjectTransferCheckpointV1,
  retainLargeObjectChunkForCheckpoint,
} from '../src/features/largeObjects/largeObjectTransferCheckpoint.ts'
import {
  planLargeObjectCiphertextRanges,
  totalCiphertextBytesForRanges,
  type LargeObjectUploadSession,
} from '../src/features/largeObjects/largeObjectTransferContract.ts'
import type { LargeObjectChunkManifest } from '../src/features/largeObjects/largeObjectProtocol.ts'

const MIB = 1024 * 1024

function session(expectedCiphertextBytes: number): LargeObjectUploadSession {
  return {
    providerId: 'test-provider',
    sessionRef: 'session://large-object-123',
    objectId: 'large-object-123',
    expectedCiphertextBytes,
  }
}

function manifestFor(
  ranges: ReturnType<typeof planLargeObjectCiphertextRanges>,
  index: number,
): LargeObjectChunkManifest {
  const range = ranges[index]
  if (!range) throw new Error('Missing test range')
  return {
    index: range.index,
    plaintextOffset: range.plaintextOffset,
    plaintextLength: range.plaintextLength,
    ciphertextByteLength: range.ciphertextByteLength,
    iv: 'A'.repeat(16),
    sha256: 'B'.repeat(43),
  }
}

test('checkpoint keeps resumable metadata without embedding the active ciphertext', () => {
  const ranges = planLargeObjectCiphertextRanges(24 * MIB, 8 * MIB)
  const total = totalCiphertextBytesForRanges(ranges)
  const checkpoint = createLargeObjectTransferCheckpoint(
    session(total),
    0,
    '2026-08-20T12:00:00.000Z',
  )

  assert.equal(isLargeObjectTransferCheckpointV1(checkpoint), true)
  assert.equal(checkpoint.activeChunk, null)
  assert.equal(JSON.stringify(checkpoint).includes('ciphertext'), false)
})

test('only the current encrypted chunk is retained and partial provider progress reuses it', () => {
  const ranges = planLargeObjectCiphertextRanges(24 * MIB, 8 * MIB)
  const total = totalCiphertextBytesForRanges(ranges)
  const initial = createLargeObjectTransferCheckpoint(session(total))
  const firstRange = ranges[0]
  if (!firstRange) throw new Error('Missing first range')
  const sourceCiphertext = new Uint8Array(firstRange.ciphertextByteLength).fill(7)

  const retained = retainLargeObjectChunkForCheckpoint(
    initial,
    ranges,
    manifestFor(ranges, 0),
    sourceCiphertext,
  )

  sourceCiphertext.fill(9)
  assert.equal(retained.retainedChunk.ciphertext[0], 7)
  assert.equal(retained.checkpoint.activeChunk?.chunkIndex, 0)
  assert.equal(retained.checkpoint.activeChunk?.confirmedInsideChunk, 0)

  const partialBytes = 512 * 1024
  const advanced = advanceLargeObjectTransferCheckpoint(
    retained.checkpoint,
    ranges,
    partialBytes,
  )

  assert.equal(advanced.clearRetainedChunk, false)
  assert.equal(advanced.checkpoint.activeChunk?.chunkIndex, 0)
  assert.equal(advanced.checkpoint.activeChunk?.confirmedInsideChunk, partialBytes)
})

test('crossing the encrypted chunk boundary explicitly releases the retained slot', () => {
  const ranges = planLargeObjectCiphertextRanges(24 * MIB, 8 * MIB)
  const total = totalCiphertextBytesForRanges(ranges)
  const firstRange = ranges[0]
  if (!firstRange) throw new Error('Missing first range')
  const retained = retainLargeObjectChunkForCheckpoint(
    createLargeObjectTransferCheckpoint(session(total)),
    ranges,
    manifestFor(ranges, 0),
    new Uint8Array(firstRange.ciphertextByteLength),
  )

  const advanced = advanceLargeObjectTransferCheckpoint(
    retained.checkpoint,
    ranges,
    firstRange.ciphertextOffset + firstRange.ciphertextByteLength,
  )

  assert.equal(advanced.clearRetainedChunk, true)
  assert.equal(advanced.checkpoint.activeChunk, null)
  assert.equal(advanced.checkpoint.confirmedCiphertextBytes, firstRange.ciphertextByteLength)
})

test('checkpoint rejects retaining a chunk that is not the provider resume position', () => {
  const ranges = planLargeObjectCiphertextRanges(24 * MIB, 8 * MIB)
  const total = totalCiphertextBytesForRanges(ranges)
  const secondRange = ranges[1]
  if (!secondRange) throw new Error('Missing second range')

  assert.throws(
    () => retainLargeObjectChunkForCheckpoint(
      createLargeObjectTransferCheckpoint(session(total)),
      ranges,
      manifestFor(ranges, 1),
      new Uint8Array(secondRange.ciphertextByteLength),
    ),
    /punto de reanudación/u,
  )
})

test('single-slot retention replaces the previous chunk and returns defensive copies', () => {
  const store = new MemorySingleLargeObjectChunkRetention()
  const first = {
    objectId: 'large-object-123',
    chunkIndex: 0,
    ciphertextOffset: 0,
    ciphertextByteLength: 4,
    iv: 'A'.repeat(16),
    sha256: 'B'.repeat(43),
    ciphertext: new Uint8Array([1, 2, 3, 4]),
  }
  store.replace(first)

  const read = store.read(first.objectId)
  assert.deepEqual(Array.from(read?.ciphertext ?? []), [1, 2, 3, 4])
  if (!read) throw new Error('Missing retained chunk')
  read.ciphertext[0] = 99
  assert.equal(store.read(first.objectId)?.ciphertext[0], 1)

  store.replace({
    ...first,
    chunkIndex: 1,
    ciphertextOffset: 4,
    ciphertext: new Uint8Array([5, 6, 7, 8]),
  })
  assert.equal(store.read(first.objectId)?.chunkIndex, 1)
  store.clear()
  assert.equal(store.read(first.objectId), null)
})

test('provider progress can only move forward and never beyond the encrypted object', () => {
  const ranges = planLargeObjectCiphertextRanges(8 * MIB, 8 * MIB)
  const total = totalCiphertextBytesForRanges(ranges)
  const checkpoint = createLargeObjectTransferCheckpoint(session(total), 100)

  assert.throws(
    () => advanceLargeObjectTransferCheckpoint(checkpoint, ranges, 99),
    /retroceder/u,
  )
  assert.throws(
    () => advanceLargeObjectTransferCheckpoint(checkpoint, ranges, total + 1),
    /no coincide/u,
  )
})
