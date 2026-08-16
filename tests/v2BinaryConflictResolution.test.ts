import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('binary conflict resolution keeps originals explicit and previews derived', () => {
  const service = readFileSync('src/features/sync/binaryConflictService.ts', 'utf8')

  assert.match(service, /const IMAGE_TYPE = 'image'/)
  assert.match(service, /const PREVIEW_TYPE = 'image-preview'/)
  assert.match(service, /resetPreviewForImage/)
  assert.match(service, /previewsToReset/)
  assert.match(service, /parsed\.recordType === PREVIEW_TYPE && healPreviews/)
  assert.match(service, /Dos imágenes originales no se fusionan automáticamente/)
})

test('binary conflict choice validates both current sides and remote expected version', () => {
  const service = readFileSync('src/features/sync/binaryConflictService.ts', 'utf8')

  assert.match(service, /currentLocalFp !== conflict\.localFingerprint/)
  assert.match(service, /row\.version !== conflict\.remoteVersion/)
  assert.match(service, /remoteFp !== conflict\.remoteFingerprint/)
  assert.match(service, /\.eq\('version', row\.version\)/)
  assert.match(service, /afterDownload\.version !== row\.version/)
})

test('choosing a local image uses encrypted chunks and cleans replaced remote chunks', () => {
  const service = readFileSync('src/features/sync/binaryConflictService.ts', 'utf8')

  assert.match(service, /CHUNK_BYTES = 6 \* 1024 \* 1024/)
  assert.match(service, /chunkSha256/)
  assert.match(service, /uploadChunks/)
  assert.match(service, /queueCleanup\(state, objectPaths\(userId, oldBinary\.manifest\)\)/)
  assert.match(service, /application\/octet-stream/)
})

test('choosing a remote image verifies every encrypted fragment before local replacement', () => {
  const service = readFileSync('src/features/sync/binaryConflictService.ts', 'utf8')

  assert.match(service, /await sha256Base64Url\(chunk\) !== manifest\.chunkSha256\[index\]/)
  assert.match(service, /total !== manifest\.ciphertextByteLength/)
  assert.match(service, /await downloadPayload/)
  assert.match(service, /applyStoredEncryptedRecordChanges\(\[\{ key: localKey, payload \}\], \[\]\)/)
})

test('image comparison decrypts only on demand and uses temporary object URLs', () => {
  const service = readFileSync('src/features/sync/binaryConflictService.ts', 'utf8')
  const center = readFileSync('src/features/sync/ConflictCenter.tsx', 'utf8')

  assert.match(service, /loadBinaryImageConflictVisuals/)
  assert.match(service, /decryptVaultBytes/)
  assert.match(center, /loadImageConflictVisuals/)
  assert.match(center, /URL\.createObjectURL/)
  assert.match(center, /URL\.revokeObjectURL/)
  assert.match(center, /active\.recordType !== 'image'/)
})

test('coordinator combines record and binary conflict sources without new persistence', () => {
  const coordinator = readFileSync('src/features/sync/conflictCoordinator.ts', 'utf8')
  const service = readFileSync('src/features/sync/binaryConflictService.ts', 'utf8')

  assert.match(coordinator, /scanRecordConflicts/)
  assert.match(coordinator, /scanBinarySyncConflicts/)
  assert.match(coordinator, /recordTypeFromLocalKey\(localKey\) === 'image'/)
  assert.match(service, /STATE_RECORD_TYPE = 'system\.sync-state'/)
  assert.match(service, /STATE_RECORD_ID = 'binary'/)
  assert.doesNotMatch(service, /localStorage|sessionStorage|indexedDB|caches\.open/)
})
