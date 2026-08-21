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

test('large-object manifests use their own authenticated encrypted cache purpose', async () => {
  const key = await createVaultKey()
  const bytes = new TextEncoder().encode(JSON.stringify([
    {
      index: 0,
      plaintextOffset: 0,
      plaintextLength: 1024,
      ciphertextByteLength: 1040,
      iv: 'opaque-iv',
      sha256: 'opaque-hash',
    },
  ]))
  const sealed = await sealLargeObjectTransferCacheBytes(
    key,
    bytes,
    'manifests',
    'persistent-object-001',
    null,
  )

  const opened = await openLargeObjectTransferCacheBytes(
    key,
    sealed,
    'manifests',
    'persistent-object-001',
    null,
  )
  assert.deepEqual(opened, bytes)
  await assert.rejects(
    () => openLargeObjectTransferCacheBytes(
      key,
      sealed,
      'checkpoint',
      'persistent-object-001',
      null,
    ),
  )
})

test('existing encrypted cache remains single-slot and backwards-compatible when manifests are absent', async () => {
  const source = await readFile(
    new URL('../src/storage/local/largeObjectTransferCache.ts', import.meta.url),
    'utf8',
  )

  assert.match(source, /const TRANSFER_CACHE_DATABASE_NAME = 'oanix-large-object-transfer-cache-v1'/u)
  assert.match(source, /const ACTIVE_TRANSFER_KEY = 'active'/u)
  assert.match(source, /manifests\?: SealedTransferCacheBytes \| null/u)
  assert.match(source, /let manifests: LargeObjectChunkManifest\[\] = \[\]/u)
  assert.doesNotMatch(source, /oanix-vault/u)
})

test('persistent state adapter reuses the encrypted cache and refuses to erase another pending object', async () => {
  const source = await readFile(
    new URL('../src/features/largeObjects/persistentLargeObjectTransferStateStore.ts', import.meta.url),
    'utf8',
  )

  assert.match(source, /implements LargeObjectTransferStateStore/u)
  assert.match(source, /loadLargeObjectTransferCache/u)
  assert.match(source, /saveLargeObjectTransferCache/u)
  assert.match(source, /snapshot\.manifests/u)
  assert.match(source, /OANIX no borrará la caché temporal de otra transferencia grande/u)
  assert.doesNotMatch(source, /indexedDB|Supabase|GoogleDrive/u)
})
