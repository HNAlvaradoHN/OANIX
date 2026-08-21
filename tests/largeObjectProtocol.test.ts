import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_LARGE_OBJECT_CHUNK_BYTES,
  LARGE_OBJECT_CHUNK_ALIGNMENT_BYTES,
  MAX_LARGE_OBJECT_BYTES,
  createLargeObjectTransferProgress,
  planLargeObjectChunks,
  validateLargeObjectChunkBytes,
} from '../src/features/largeObjects/largeObjectProtocol.ts'

const MiB = 1024 * 1024
const GiB = 1024 * MiB

test('planifica 100 MB sin cargar el archivo en memoria', () => {
  const chunks = planLargeObjectChunks(100 * MiB)
  assert.equal(chunks.length, 13)
  assert.equal(chunks[0].plaintextOffset, 0)
  assert.equal(chunks[0].plaintextLength, DEFAULT_LARGE_OBJECT_CHUNK_BYTES)
  assert.equal(chunks.at(-1)?.plaintextLength, 4 * MiB)
})

test('planifica 1 GiB en fragmentos contiguos', () => {
  const chunks = planLargeObjectChunks(GiB)
  assert.equal(chunks.length, 128)
  assert.equal(chunks.at(-1)?.plaintextOffset, GiB - DEFAULT_LARGE_OBJECT_CHUNK_BYTES)
  assert.equal(
    chunks.reduce((total, chunk) => total + chunk.plaintextLength, 0),
    GiB,
  )
})

test('planifica 5 GiB con una cantidad razonable de fragmentos', () => {
  const chunks = planLargeObjectChunks(5 * GiB)
  assert.equal(chunks.length, 640)
  assert.equal(chunks.at(-1)?.plaintextLength, DEFAULT_LARGE_OBJECT_CHUNK_BYTES)
  assert.equal(chunks.at(-1]?.plaintextOffset, (640 - 1) * DEFAULT_LARGE_OBJECT_CHUNK_BYTES)
})

test('acepta tamaños de fragmento alineados a 256 KiB y rechaza los demás', () => {
  assert.equal(validateLargeObjectChunkBytes(4 * MiB), 4 * MiB)
  assert.equal((4 * MiB) % LARGE_OBJECT_CHUNK_ALIGNMENT_BYTES, 0)
  assert.throws(() => validateLargeObjectChunkBytes((4 * MiB) + 1))
})

test('no permite que el progreso anuncie 100% antes de verificar almacenamiento', () => {
  const uploading = createLargeObjectTransferProgress('uploading', 5 * GiB, 5 * GiB)
  assert.equal(uploading.percent, 99.99)

  const stored = createLargeObjectTransferProgress('stored', 5 * GiB, 5 * GiB)
  assert.equal(stored.percent, 100)
})

test('mantiene un techo inicial por encima de 5 GiB', () => {
  assert.ok(MAX_LARGE_OBJECT_BYTES > 5 * GiB)
  assert.doesNotThrow(() => planLargeObjectChunks(5 * GiB))
  assert.throws(() => planLargeObjectChunks(MAX_LARGE_OBJECT_BYTES + 1))
})
