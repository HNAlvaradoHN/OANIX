import assert from 'node:assert/strict'
import test from 'node:test'

import { processLargeObjectChunks } from '../src/features/largeObjects/largeObjectChunkCrypto.ts'
import {
  DEFAULT_LARGE_OBJECT_CHUNK_BYTES,
  type LargeObjectTransferProgress,
} from '../src/features/largeObjects/largeObjectProtocol.ts'

const MiB = 1024 * 1024
const CONTROLLED_FILE_BYTES = 128 * MiB

async function createVaultKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

test('controlled 128 MiB file encrypts sequentially in bounded 8 MiB chunks before any 1 GiB or 5 GiB field test', async () => {
  const sourceChunk = new Uint8Array(DEFAULT_LARGE_OBJECT_CHUNK_BYTES)
  for (let index = 0; index < sourceChunk.length; index += 1) sourceChunk[index] = index % 251
  const blob = new Blob(new Array(CONTROLLED_FILE_BYTES / sourceChunk.byteLength).fill(sourceChunk))
  const phases: LargeObjectTransferProgress['phase'][] = []
  let consumedChunks = 0
  let maxCiphertextBytesSeen = 0
  let activeConsumers = 0
  let maxActiveConsumers = 0

  const manifests = await processLargeObjectChunks({
    blob,
    vaultKey: await createVaultKey(),
    objectId: 'controlled-128mib-001',
    consumeEncryptedChunk: async (chunk) => {
      activeConsumers += 1
      maxActiveConsumers = Math.max(maxActiveConsumers, activeConsumers)
      consumedChunks += 1
      maxCiphertextBytesSeen = Math.max(maxCiphertextBytesSeen, chunk.ciphertext.byteLength)
      await Promise.resolve()
      activeConsumers -= 1
    },
    onProgress: (progress) => phases.push(progress.phase),
  })

  assert.equal(blob.size, CONTROLLED_FILE_BYTES)
  assert.equal(manifests.length, 16)
  assert.equal(consumedChunks, 16)
  assert.equal(maxActiveConsumers, 1)
  assert.ok(maxCiphertextBytesSeen <= DEFAULT_LARGE_OBJECT_CHUNK_BYTES + 16)
  assert.equal(manifests.reduce((sum, chunk) => sum + chunk.plaintextLength, 0), CONTROLLED_FILE_BYTES)
  assert.equal(phases[0], 'preparing')
  assert.ok(phases.includes('encrypting'))
  assert.ok(phases.includes('uploading'))
  assert.equal(phases.at(-1), 'verifying')
  assert.ok(!phases.includes('stored'))
})
