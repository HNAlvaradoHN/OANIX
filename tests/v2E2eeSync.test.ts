import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('V2 E2EE reuses auth and keeps ordinary remote identifiers cryptographically random', () => {
  const accountSource = readFileSync('src/features/account/accountService.ts', 'utf8')
  const syncSource = readFileSync('src/features/sync/syncService.ts', 'utf8')

  assert.equal((accountSource.match(/createClient\(/g) ?? []).length, 1)
  assert.match(accountSource, /export function getOnlineDataClient/)
  assert.match(syncSource, /getOnlineDataClient/)
  assert.doesNotMatch(syncSource, /createClient\(/)

  assert.match(syncSource, /encryptVaultJson/)
  assert.match(syncSource, /decryptVaultJson/)
  assert.match(syncSource, /newOpaqueRecordKey/)
  assert.match(syncSource, /crypto\?\.randomUUID|crypto\.randomUUID/)
  assert.match(syncSource, /getRandomValues\(new Uint8Array\(24\)\)/)
  assert.match(syncSource, /protocol: SYNC_ENVELOPE_PROTOCOL/)
  assert.match(syncSource, /localKey: record\.key/)
  assert.match(syncSource, /return JSON\.stringify\(encryptedEnvelope\)/)
})

test('remote envelopes are related to local records only after local decryption', () => {
  const syncSource = readFileSync('src/features/sync/syncService.ts', 'utf8')

  assert.match(syncSource, /select\('record_key, ciphertext, version, deleted'\)/)
  assert.match(syncSource, /await decryptRemoteEnvelope\(vaultKey, row\)/)
  assert.match(syncSource, /remoteActiveByLocalKey\.set\(envelope\.localKey/)
  assert.match(syncSource, /payloadFingerprint\(remoteEnvelope\.payload\)/)
  assert.match(syncSource, /OANIX no sobrescribirá nada/)
})

test('E2EE keeps one local database while rebuild adds one shared indexed store', () => {
  const syncSource = readFileSync('src/features/sync/syncService.ts', 'utf8')
  const databaseSource = readFileSync('src/storage/local/database.ts', 'utf8')

  assert.doesNotMatch(syncSource, /localStorage|sessionStorage|indexedDB|caches\.open/)
  assert.doesNotMatch(syncSource, /service_role/i)
  assert.match(syncSource, /SYNC_STATE_RECORD_TYPE = 'system\.sync-state'/)
  assert.match(syncSource, /writeEncryptedRecord<SyncStateRecord>/)

  const createStoreCalls = databaseSource.match(/\.createObjectStore\(/g) ?? []
  assert.equal(createStoreCalls.length, 3)
  assert.match(databaseSource, /V2_ENCRYPTED_RECORDS_STORE = 'encrypted_records_v2'/)
})

test('remote mutations use optimistic version checks and never rewrite ownership columns', () => {
  const syncSource = readFileSync('src/features/sync/syncService.ts', 'utf8')

  assert.match(syncSource, /\.eq\('version', existing\.version\)/)
  assert.match(syncSource, /\.eq\('version', remote\.version\)|\.eq\('version', existing\.version\)/)
  assert.match(syncSource, /version: existing\.version \+ 1/)

  const updateBlocks = [...syncSource.matchAll(/\.update\(\{([\s\S]*?)\}\)\n\s*\.eq\('user_id'/g)]
    .map((match) => match[1])
  assert.ok(updateBlocks.length >= 2)
  for (const block of updateBlocks) {
    assert.doesNotMatch(block, /user_id|record_key|updated_at/)
  }
})
