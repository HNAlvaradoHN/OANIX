import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('encrypted image autosync uses one private bucket contract with bounded chunks', () => {
  const source = readFileSync('src/features/sync/binarySyncService.ts', 'utf8')

  assert.match(source, /STORAGE_BUCKET = 'oanix-encrypted-blobs'/)
  assert.match(source, /CHUNK_BYTES = 6 \* 1024 \* 1024/)
  assert.match(source, /BASE64_CHARS_PER_CHUNK/)
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

test('legacy image autosync remains compact while rebuild adds one shared v2 store', () => {
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
  assert.equal(createStoreCalls.length, 3)
  assert.match(database, /V2_ENCRYPTED_RECORDS_STORE = 'encrypted_records_v2'/)
})

test('binary transfer verifies each bounded ciphertext chunk before rebuilding the local payload', () => {
  const source = readFileSync('src/features/sync/binarySyncService.ts', 'utf8')

  assert.match(source, /chunkSha256/)
  assert.match(source, /inspectLocalBinary/)
  assert.match(source, /sha256Base64Url\(chunk\)/)
  assert.match(source, /La verificación de integridad de un fragmento cifrado no coincide/)
  assert.match(source, /applyStoredEncryptedRecordChanges/)
  assert.match(source, /scheme: manifest\.scheme/)
  assert.match(source, /iv: manifest\.iv/)
  assert.match(source, /ciphertext: base64Parts\.join\(''\)/)
  assert.doesNotMatch(source, /base64ToBytes\(payload\.ciphertext\)/)
})

test('binary updates use optimistic versions, reuse tombstones and retain a compact encrypted cleanup queue', () => {
  const source = readFileSync('src/features/sync/binarySyncService.ts', 'utf8')

  assert.match(source, /\.eq\('version', targetRow\.version\)/)
  assert.match(source, /insertOrUpdateBinaryRemote\(session\.userId, vaultKey, local, localInspection, remoteRow, state\)/)
  assert.match(source, /cleanupPaths/)
  assert.match(source, /queueCleanup/)
  assert.match(source, /flushCleanupQueue/)
  assert.match(source, /conflicts \+= 1/)
})
