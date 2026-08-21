import assert from 'node:assert/strict'
import test from 'node:test'

import {
  encryptLargeObjectChunk,
  processLargeObjectChunks,
} from '../src/features/largeObjects/largeObjectChunkCrypto.ts'
import { planLargeObjectChunks } from '../src/features/largeObjects/largeObjectProtocol.ts'

const MiB = 1024 * 1024

async function createVaultKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

test('cifra un fragmento con AES-GCM, IV aleatorio e integridad SHA-256', async () => {
  const key = await createVaultKey()
  const [plan] = planLargeObjectChunks(MiB, MiB)
  const plaintext = new Uint8Array(MiB)
  plaintext.fill(0x5a)

  const encrypted = await encryptLargeObjectChunk(key, 'object-test-0001', plan, plaintext)

  assert.equal(encrypted.ciphertext.byteLength, plaintext.byteLength + 16)
  assert.equal(encrypted.manifest.ciphertextByteLength, encrypted.ciphertext.byteLength)
  assert.match(encrypted.manifest.iv, /^[A-Za-z0-9_-]{16}$/)
  assert.match(encrypted.manifest.sha256, /^[A-Za-z0-9_-]{43}$/)
  assert.notEqual(encrypted.ciphertext[0], plaintext[0])
})

test('procesa un Blob grande de forma secuencial sin conservar ciphertext entre fragmentos', async () => {
  const key = await createVaultKey()
  const byteLength = (2 * MiB) + (MiB / 2)
  const source = new Uint8Array(byteLength)
  for (let index = 0; index < source.length; index += 1) source[index] = index % 251
  const blob = new Blob([source])

  let activeConsumers = 0
  let maxActiveConsumers = 0
  const heldCiphertexts: Uint8Array[] = []

  const manifests = await processLargeObjectChunks({
    blob,
    vaultKey: key,
    objectId: 'object-test-0002',
    chunkBytes: MiB,
    consumeEncryptedChunk: async (chunk) => {
      activeConsumers += 1
      maxActiveConsumers = Math.max(maxActiveConsumers, activeConsumers)
      heldCiphertexts.push(chunk.ciphertext)
      await Promise.resolve()
      activeConsumers -= 1
    },
  })

  assert.equal(manifests.length, 3)
  assert.deepEqual(manifests.map((chunk) => chunk.plaintextLength), [MiB, MiB, MiB / 2])
  assert.equal(maxActiveConsumers, 1)
  assert.ok(heldCiphertexts.every((chunk) => chunk.every((byte) => byte === 0)))
})

test('emite progreso por fases sin declarar stored antes de una verificación externa', async () => {
  const key = await createVaultKey()
  const blob = new Blob([new Uint8Array((2 * MiB) + 7)])
  const phases: string[] = []
  const percentages: number[] = []

  await processLargeObjectChunks({
    blob,
    vaultKey: key,
    objectId: 'object-test-0003',
    chunkBytes: MiB,
    onProgress: (progress) => {
      phases.push(progress.phase)
      percentages.push(progress.percent)
    },
    consumeEncryptedChunk: async () => {},
  })

  assert.equal(phases[0], 'preparing')
  assert.ok(phases.includes('encrypting'))
  assert.ok(phases.includes('uploading'))
  assert.equal(phases.at(-1), 'verifying')
  assert.ok(!phases.includes('stored'))
  assert.ok(percentages.every((percent) => percent < 100))
})

test('cada fragmento queda ligado a su posición mediante metadatos distintos', async () => {
  const key = await createVaultKey()
  const plans = planLargeObjectChunks(2 * MiB, MiB)
  const plaintext = new Uint8Array(MiB)

  const first = await encryptLargeObjectChunk(key, 'object-test-0004', plans[0], plaintext)
  const second = await encryptLargeObjectChunk(key, 'object-test-0004', plans[1], plaintext)

  assert.notEqual(first.manifest.iv, second.manifest.iv)
  assert.equal(first.manifest.plaintextOffset, 0)
  assert.equal(second.manifest.plaintextOffset, MiB)
  assert.notEqual(first.manifest.sha256, second.manifest.sha256)
})
