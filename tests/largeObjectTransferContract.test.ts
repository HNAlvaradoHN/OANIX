import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LARGE_OBJECT_GCM_TAG_BYTES,
  locateLargeObjectResumePosition,
  planLargeObjectCiphertextRanges,
  totalCiphertextBytesForRanges,
  validateUploadRangeRequest,
  type LargeObjectUploadSession,
} from '../src/features/largeObjects/largeObjectTransferContract.ts'

const MiB = 1024 * 1024
const GiB = 1024 * MiB

test('un archivo de 5 GiB conserva un único flujo remoto con 640 rangos cifrados', () => {
  const ranges = planLargeObjectCiphertextRanges(5 * GiB)
  assert.equal(ranges.length, 640)
  assert.equal(ranges[0].ciphertextOffset, 0)
  assert.equal(ranges[0].ciphertextByteLength, (8 * MiB) + LARGE_OBJECT_GCM_TAG_BYTES)
  assert.equal(ranges[1].ciphertextOffset, ranges[0].ciphertextByteLength)
  assert.equal(
    totalCiphertextBytesForRanges(ranges),
    (5 * GiB) + (ranges.length * LARGE_OBJECT_GCM_TAG_BYTES),
  )
})

test('ubica reanudación exacta entre fragmentos', () => {
  const ranges = planLargeObjectCiphertextRanges(24 * MiB)
  const confirmed = ranges[0].ciphertextByteLength
  const resume = locateLargeObjectResumePosition(ranges, confirmed)

  assert.equal(resume.nextChunkIndex, 1)
  assert.equal(resume.offsetInsideChunk, 0)
  assert.equal(resume.complete, false)
})

test('ubica reanudación a mitad del fragmento cifrado actual', () => {
  const ranges = planLargeObjectCiphertextRanges(24 * MiB)
  const partialInsideSecondChunk = ranges[1].ciphertextOffset + (3 * MiB)
  const resume = locateLargeObjectResumePosition(ranges, partialInsideSecondChunk)

  assert.equal(resume.nextChunkIndex, 1)
  assert.equal(resume.offsetInsideChunk, 3 * MiB)
  assert.equal(resume.complete, false)
})

test('reanudación completa queda después del último fragmento', () => {
  const ranges = planLargeObjectCiphertextRanges(10 * MiB)
  const total = totalCiphertextBytesForRanges(ranges)
  const resume = locateLargeObjectResumePosition(ranges, total)

  assert.equal(resume.complete, true)
  assert.equal(resume.nextChunkIndex, ranges.length)
  assert.equal(resume.offsetInsideChunk, 0)
})

test('rechaza estados remotos que exceden el tamaño cifrado esperado', () => {
  const ranges = planLargeObjectCiphertextRanges(10 * MiB)
  const total = totalCiphertextBytesForRanges(ranges)
  assert.throws(() => locateLargeObjectResumePosition(ranges, total + 1))
})

test('el contrato de rango no permite escribir más allá del objeto remoto', () => {
  const ranges = planLargeObjectCiphertextRanges(10 * MiB)
  const total = totalCiphertextBytesForRanges(ranges)
  const session: LargeObjectUploadSession = {
    providerId: 'test-provider',
    sessionRef: 'session-0001',
    objectId: 'object-0001',
    expectedCiphertextBytes: total,
  }

  assert.doesNotThrow(() => validateUploadRangeRequest({
    session,
    ciphertextOffset: 0,
    bytes: new Uint8Array(1024),
    totalCiphertextBytes: total,
  }))

  assert.throws(() => validateUploadRangeRequest({
    session,
    ciphertextOffset: total - 512,
    bytes: new Uint8Array(1024),
    totalCiphertextBytes: total,
  }))
})
