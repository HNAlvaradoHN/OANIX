import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  openLargeObjectTransferCacheBytes,
  sealLargeObjectTransferCacheBytes,
} from '../src/storage/local/largeObjectTransferCache.ts'

async function createVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

test('transient large-object cache seals bytes under the active vault key contract', async () => {
  const key = await createVaultKey()
  const plaintext = new TextEncoder().encode('checkpoint-secret-session-ref')
  const sealed = await sealLargeObjectTransferCacheBytes(
    key,
    plaintext,
    'checkpoint',
    'large-object-123',
    null,
  )

  assert.notDeepEqual(
    Array.from(new Uint8Array(sealed.ciphertext).slice(0, plaintext.length)),
    Array.from(plaintext),
  )
  const opened = await openLargeObjectTransferCacheBytes(
    key,
    sealed,
    'checkpoint',
    'large-object-123',
    null,
  )
  assert.equal(new TextDecoder().decode(opened), 'checkpoint-secret-session-ref')
})

test('cache authentication binds ciphertext to purpose object and chunk index', async () => {
  const key = await createVaultKey()
  const sealed = await sealLargeObjectTransferCacheBytes(
    key,
    new Uint8Array([1, 2, 3, 4]),
    'chunk',
    'large-object-123',
    7,
  )

  await assert.rejects(
    () => openLargeObjectTransferCacheBytes(
      key,
      sealed,
      'chunk',
      'large-object-123',
      8,
    ),
  )
  await assert.rejects(
    () => openLargeObjectTransferCacheBytes(
      key,
      sealed,
      'checkpoint',
      'large-object-123',
      7,
    ),
  )
})

test('transient cache is isolated from the canonical vault database and normal sync store', async () => {
  const source = await readFile(
    new URL('../src/storage/local/largeObjectTransferCache.ts', import.meta.url),
    'utf8',
  )

  assert.match(source, /oanix-large-object-transfer-cache-v1/u)
  assert.doesNotMatch(source, /oanix-vault/u)
  assert.doesNotMatch(source, /ENCRYPTED_RECORDS_STORE/u)
  assert.doesNotMatch(source, /oanix:local-data-changed/u)
  assert.doesNotMatch(source, /Supabase|Drive/u)
})

test('transient cache uses exactly one active IndexedDB record slot', async () => {
  const source = await readFile(
    new URL('../src/storage/local/largeObjectTransferCache.ts', import.meta.url),
    'utf8',
  )

  assert.match(source, /const ACTIVE_TRANSFER_KEY = 'active'/u)
  assert.match(source, /existing\.objectId !== checkpoint\.objectId/u)
  assert.match(source, /otra transferencia grande pendiente/u)
})

test('temporary decrypted buffers are explicitly cleared after save or load paths', async () => {
  const source = await readFile(
    new URL('../src/storage/local/largeObjectTransferCache.ts', import.meta.url),
    'utf8',
  )

  assert.match(source, /checkpointBytes\.fill\(0\)/u)
  assert.match(source, /retainedBytes\?\.fill\(0\)/u)
})
