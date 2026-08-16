import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('multi-device bootstrap reuses the existing wrapped vault key protection', () => {
  const syncSource = readFileSync('src/features/sync/syncService.ts', 'utf8')
  const gateSource = readFileSync('src/app/VaultGate.tsx', 'utf8')

  assert.match(syncSource, /VAULT_BOOTSTRAP_PROTOCOL = 'oanix-vault-bootstrap-v1'/)
  assert.match(syncSource, /metadata,/)
  assert.match(syncSource, /openVaultProtection\(masterPassword, bootstrap\.metadata\.protection\)/)
  assert.match(syncSource, /replaceLocalVaultSnapshot/)
  assert.match(syncSource, /setActiveVaultKey\(vaultKey\)/)
  assert.match(gateSource, /Conectar mi cuenta sincronizada/)
  assert.match(gateSource, /Traer mi bóveda a este dispositivo/)
  assert.match(gateSource, /misma contraseña maestra/)
})

test('automatic sync runs after local changes and when the app returns online or visible', () => {
  const runtime = readFileSync('src/features/sync/AutoSyncRuntime.tsx', 'utf8')
  const recordRepo = readFileSync('src/storage/repositories/encryptedRecordRepository.ts', 'utf8')

  assert.match(recordRepo, /oanix:local-data-changed/)
  assert.match(runtime, /addEventListener\('oanix:local-data-changed'/)
  assert.match(runtime, /addEventListener\('online'/)
  assert.match(runtime, /visibilitychange/)
  assert.match(runtime, /30_000/)
  assert.match(runtime, /syncEncryptedVaultBidirectional/)
  assert.match(runtime, /onRemoteAppliedRef\.current\(\)/)
})

test('remote changes refresh the workspace without reloading or relocking the vault', () => {
  const app = readFileSync('src/app/App.tsx', 'utf8')

  assert.match(app, /workspaceRevision/)
  assert.match(app, /<NotesWorkspace key=\{workspaceRevision\}/)
  assert.match(app, /onRemoteApplied=\{\(\) => setWorkspaceRevision/)
  assert.doesNotMatch(app, /location\.reload\(\)/)
})

test('multi-device sync detects divergence but does not implement conflict resolution early', () => {
  const syncSource = readFileSync('src/features/sync/syncService.ts', 'utf8')
  const roadmap = readFileSync('docs/ROADMAP.md', 'utf8')
  const databaseSource = readFileSync('src/storage/local/database.ts', 'utf8')

  assert.match(syncSource, /localChanged && remoteChanged/)
  assert.match(syncSource, /conflicts \+= 1/)
  assert.match(syncSource, /\.eq\('version', existing\.version\)/)
  assert.match(roadmap, /\[ \] Resolución de conflictos/)
  assert.match(roadmap, /system\.sync-state/)

  const createStoreCalls = databaseSource.match(/\.createObjectStore\(/g) ?? []
  assert.equal(createStoreCalls.length, 2)
})
