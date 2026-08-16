import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('encrypted image autosync uses one private bucket contract with bounded chunks', () => {
  const source = readFileSync('src/features/sync/binarySyncService.ts', 'utf8')

  assert.match(source, /STORAGE_BUCKET = 'oanix-encrypted-blobs'/)
  assert.match(source, /CHUNK_BYTES = 8 \* 1024 \* 1024/)
  assert.match(source, /application\/octet-stream/)
  assert.match(source, /\.storage\.from\(STORAGE_BUCKET\)/)
  assert.match(source, /\.upload\(/)
  assert.match(source, /\.download\(/)
  assert.match(source, /\.remove\(/)
  assert.doesNotMatch(source, /getPublicUrl|createSignedUrl/)
})

test('binary object paths reveal only account ownership and random storage identifiers', () => {
  const source = readFileSync('src/features/sync/binarySyncService.ts', 'utf8')

  assert.match(source, /newOpaqueId/)
  assert.match(source, /`\$\{userId\}\/\$\{manifest\.objectPrefix\}\/\$\{String\(index\)/)
  assert.match(source, /localKey,/)
  assert.match(source, /encryptVaultJson\(vaultKey, manifest/)
  assert.doesNotMatch(source, /file\.name|imageId|recordId.*objectPrefix/)
})

test('image changes enter the same automatic sync runtime without another local store', () => {
  const runtime = readFileSync('src/features/sync/AutoSyncRuntime.tsx', 'utf8')
  const blobs = readFileSync('src/storage/repositories/encryptedBlobRepository.ts', 'utf8')
  const binary = readFileSync('src/features/sync/binarySyncService.ts', 'utf8')
  const database = readFileSync('src/storage/local/database.ts', 'utf8')

  assert.match(blobs, /oanix:local-data-changed/)
  assert.match(runtime, /syncEncryptedBinariesBidirectional/)
  assert.match(runtime, /incluidas imágenes|datos e imágenes/)
  assert.match(binary, /BINARY_STATE_RECORD_TYPE = 'system\.sync-state'/)
  assert.match(binary, /BINARY_STATE_RECORD_ID = 'binary'/)
  assert.doesNotMatch(binary, /localStorage|sessionStorage|indexedDB|caches\.open/)

  const createStoreCalls = database.match(/\.createObjectStore\(/g) ?? []
  assert.equal(createStoreCalls.length, 2)
})

test('binary transfer verifies ciphertext before rebuilding the existing local encrypted payload', () => {
  const source = readFileSync('src/features/sync/binarySyncService.ts', 'utf8')

  assert.match(source, /ciphertextSha256/)
  assert.match(source, /sha256Base64Url\(bytes\)/)
  assert.match(source, /La verificación de integridad de la imagen cifrada no coincide/)
  assert.match(source, /applyStoredEncryptedRecordChanges/)
  assert.match(source, /scheme: manifest\.scheme/)
  assert.match(source, /iv: manifest\.iv/)
  assert.match(source, /ciphertext: bytesToBase64\(bytes\)/)
})

test('binary updates use optimistic versions and retain a compact encrypted cleanup queue', () => {
  const source = readFileSync('src/features/sync/binarySyncService.ts', 'utf8')

  assert.match(source, /\.eq\('version', existing\.row\.version\)/)
  assert.match(source, /cleanupPaths/)
  assert.match(source, /queueCleanup/)
  assert.match(source, /flushCleanupQueue/)
  assert.match(source, /conflicts \+= 1/)
})
