import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('V2 E2EE transport reuses auth and keeps remote identifiers cryptographically random', () => {
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
  assert.doesNotMatch(syncSource, /'SHA-256'|sync-key/)
  assert.match(syncSource, /protocol: SYNC_ENVELOPE_PROTOCOL/)
  assert.match(syncSource, /localKey: record\.key/)
  assert.match(syncSource, /return JSON\.stringify\(encryptedEnvelope\)/)
})

test('existing opaque rows are matched only after local E2EE decryption and unchanged data is not rewritten', () => {
  const syncSource = readFileSync('src/features/sync/syncService.ts', 'utf8')

  assert.match(syncSource, /select\('record_key, ciphertext, version, deleted'\)/)
  assert.match(syncSource, /await decryptRemoteEnvelope\(vaultKey, row\)/)
  assert.match(syncSource, /existingByLocalKey\.set\(envelope\.localKey/)
  assert.match(syncSource, /encryptedPayloadMatches\(existing\.envelope\.payload, record\.payload\)/)
  assert.match(syncSource, /unchanged \+= 1/)
  assert.match(syncSource, /OANIX no los sobrescribirá/)
})

test('first E2EE transport keeps heavy binaries local and creates no parallel persistence', () => {
  const syncSource = readFileSync('src/features/sync/syncService.ts', 'utf8')
  const snapshotSource = readFileSync('src/storage/repositories/vaultSnapshotRepository.ts', 'utf8')
  const databaseSource = readFileSync('src/storage/local/database.ts', 'utf8')
  const panelSource = readFileSync('src/features/account/AccountPanel.tsx', 'utf8')

  assert.match(syncSource, /new Set\(\['image', 'image-preview'\]\)/)
  assert.match(snapshotSource, /readStoredEncryptedRecordsMatching/)
  assert.match(snapshotSource, /openCursor\(\)/)
  assert.match(panelSource, /Las imágenes\/binarios todavía no se transportan/)
  assert.match(panelSource, /E2EE en validación · binarios pendientes/)

  assert.doesNotMatch(syncSource, /localStorage|sessionStorage|indexedDB|caches\.open/)
  assert.doesNotMatch(syncSource, /service_role|contraseña maestra|master password/i)

  const createStoreCalls = databaseSource.match(/\.createObjectStore\(/g) ?? []
  assert.equal(createStoreCalls.length, 2)
})

test('E2EE upload updates only mutable remote columns for existing rows', () => {
  const syncSource = readFileSync('src/features/sync/syncService.ts', 'utf8')

  assert.match(syncSource, /\.insert\(\{[\s\S]*user_id: session\.userId,[\s\S]*record_key: recordKey/)
  assert.match(syncSource, /\.update\(\{[\s\S]*ciphertext,[\s\S]*version: currentVersion \+ 1,[\s\S]*deleted: false/)

  const updateBlock = syncSource.match(/\.update\(\{([\s\S]*?)\}\)\n\s*\.eq\('user_id'/)?.[1] ?? ''
  assert.doesNotMatch(updateBlock, /user_id|record_key|updated_at/)
})
