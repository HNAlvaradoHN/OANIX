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
  assert.match(gateSource, /Bóveda sincronizada con Google/)
  assert.match(gateSource, /Modo local/)
  assert.match(gateSource, /Contraseña maestra de tu bóveda/)
})

test('vault gate asks for an access path before showing a password form', () => {
  const gateSource = readFileSync('src/app/VaultGate.tsx', 'utf8')

  assert.match(gateSource, /type AccessChoice = 'choose' \| 'local' \| 'synced'/)
  assert.match(gateSource, /Elige cómo entrar/)
  assert.match(gateSource, /chooseAccess\('synced'\)/)
  assert.match(gateSource, /chooseAccess\('local'\)/)
  assert.match(gateSource, /accessChoice === 'choose'/)
  assert.match(gateSource, /accessChoice === 'local'/)
  assert.match(gateSource, /accessChoice === 'synced'|syncedAccess/)
  assert.match(gateSource, /setAccessChoice\('choose'\)/)
})

test('synchronized access opens an already-linked local vault without replacing it', () => {
  const gateSource = readFileSync('src/app/VaultGate.tsx', 'utf8')

  assert.match(gateSource, /const localUnlock = await unlockLocalVault\(cloudPassword\)/)
  assert.match(gateSource, /await ensureRemoteVaultBootstrap\(\)/)
  assert.match(gateSource, /setState\('unlocked'\)/)
  assert.match(gateSource, /Si esta ya es la misma bóveda del dispositivo, OANIX la abre directamente/)
})

test('a different local vault is only replaced after explicit confirmation', () => {
  const gateSource = readFileSync('src/app/VaultGate.tsx', 'utf8')

  assert.match(gateSource, /otra clave de bóveda/)
  assert.match(gateSource, /Este dispositivo tiene una bóveda local diferente/)
  assert.match(gateSource, /Si quieres conservar la bóveda local actual, cancela y crea primero un backup cifrado/)
  assert.match(gateSource, /restoreSyncedVaultToThisDevice\(cloudPassword\)/)
  assert.match(gateSource, /syncEncryptedBinariesBidirectional/)
})

test('cloud restore exposes meaningful stages instead of one indefinite busy label', () => {
  const gateSource = readFileSync('src/app/VaultGate.tsx', 'utf8')

  assert.match(gateSource, /Comprobando esta bóveda/)
  assert.match(gateSource, /Verificando contraseña y registros cifrados/)
  assert.match(gateSource, /Sincronizando imágenes cifradas/)
  assert.match(gateSource, /Comprobando almacenamiento local/)
  assert.doesNotMatch(gateSource, /Descifrando y descargando…/)
})

test('vault account callback remains stable so auth session events do not create a request loop', () => {
  const gateSource = readFileSync('src/app/VaultGate.tsx', 'utf8')

  assert.match(gateSource, /useCallback/)
  assert.match(gateSource, /const handleAccountSessionChange = useCallback/)
  assert.match(gateSource, /onSessionChange=\{handleAccountSessionChange\}/)
  assert.doesNotMatch(gateSource, /onSessionChange=\{\(session\) => void handleAccountSessionChange\(session\)\}/)
})

test('automatic sync reacts quickly to local and remote changes with a polling fallback', () => {
  const runtime = readFileSync('src/features/sync/AutoSyncRuntime.tsx', 'utf8')
  const recordRepo = readFileSync('src/storage/repositories/encryptedRecordRepository.ts', 'utf8')

  assert.match(recordRepo, /oanix:local-data-changed/)
  assert.match(runtime, /addEventListener\('oanix:local-data-changed'/)
  assert.match(runtime, /addEventListener\('online'/)
  assert.match(runtime, /visibilitychange/)
  assert.match(runtime, /delay = 250/)
  assert.match(runtime, /getOnlineDataClient/)
  assert.match(runtime, /postgres_changes/)
  assert.match(runtime, /table: 'sync_records'/)
  assert.match(runtime, /filter: `user_id=eq\.\$\{userId\}`/)
  assert.match(runtime, /removeChannel\(channel\)/)
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

test('multi-device sync detects divergence and hands it to implemented conflict resolution without new stores', () => {
  const syncSource = readFileSync('src/features/sync/syncService.ts', 'utf8')
  const conflictCenter = readFileSync('src/features/sync/ConflictCenter.tsx', 'utf8')
  const roadmap = readFileSync('docs/ROADMAP.md', 'utf8')
  const memory = readFileSync('docs/PROJECT_MEMORY.md', 'utf8')
  const databaseSource = readFileSync('src/storage/local/database.ts', 'utf8')

  assert.match(syncSource, /localChanged && remoteChanged/)
  assert.match(syncSource, /conflicts \+= 1/)
  assert.match(syncSource, /\.eq\('version', existing\.version\)/)
  assert.match(conflictCenter, /Conflicto|conflicto/)
  assert.match(roadmap, /\[x\] Resolución de conflictos/)
  assert.match(roadmap, /system\.sync-state/)
  assert.match(memory, /#69/)
  assert.match(memory, /VALIDATION_DEBT/)

  const createStoreCalls = databaseSource.match(/\.createObjectStore\(/g) ?? []
  assert.equal(createStoreCalls.length, 2)
})
