import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('V2 conflict resolution reuses the encrypted sync state without parallel persistence', () => {
  const service = readFileSync('src/features/sync/conflictService.ts', 'utf8')
  assert.match(service, /SYNC_STATE_TYPE = 'system\.sync-state'/)
  assert.match(service, /SYNC_STATE_ID = 'primary'/)
  assert.match(service, /readEncryptedRecord/)
  assert.match(service, /writeEncryptedRecord/)
  assert.doesNotMatch(service, /localStorage|sessionStorage|indexedDB|caches\.open/)
})

test('conflict choices are explicit and remote writes remain optimistic', () => {
  const service = readFileSync('src/features/sync/conflictService.ts', 'utf8')
  const center = readFileSync('src/features/sync/ConflictCenter.tsx', 'utf8')

  assert.match(service, /SyncConflictResolutionChoice = 'local' \| 'remote' \| 'combine'/)
  assert.match(service, /\.eq\('version', current\.version\)/)
  assert.match(service, /Otro dispositivo cambió esta versión mientras la resolvías/)
  assert.match(center, /Usar esta versión/)
  assert.match(center, /Combinar ambas/)
  assert.match(center, /OANIX conservó ambas versiones y no sobrescribió nada/)
})

test('a tombstoned remote identity with one active successor remains resolvable', () => {
  const service = readFileSync('src/features/sync/conflictService.ts', 'utf8')

  assert.match(service, /if \(!remote\) \{[\s\S]*?if \(active\) \{[\s\S]*?active\.envelope\.payload[\s\S]*?!local, false/)
  assert.match(service, /if \(active && active\.row\.record_key !== baseline\.remoteKey\) \{[\s\S]*?if \(remote\.deleted\) \{[\s\S]*?active\.row[\s\S]*?active\.envelope\.payload[\s\S]*?!local, false/)
  assert.match(service, /Existen dos identidades remotas incompatibles para el mismo registro/)
})

test('combining notes keeps the remotely accepted version first and preserves block types', () => {
  const service = readFileSync('src/features/sync/conflictService.ts', 'utf8')
  const memory = readFileSync('docs/PROJECT_MEMORY.md', 'utf8')

  assert.match(service, /blocks: \[\.\.\.remote\.content\.blocks, \.\.\.local\.content\.blocks\.map\(cloneBlock\)\]/)
  assert.match(service, /type StoredNoteBlock/)
  assert.match(service, /remoteAcceptedFirst: true/)
  assert.doesNotMatch(service, /Versión A|Versión B|PC:|Teléfono:/)
  assert.match(memory, /aceptado primero por la sincronización remota/)
})

test('combine is disabled when note metadata diverges instead of inventing a merge', () => {
  const service = readFileSync('src/features/sync/conflictService.ts', 'utf8')

  assert.match(service, /remote\.title === local\.title/)
  assert.match(service, /remote\.folderId/)
  assert.match(service, /JSON\.stringify\(tags\(remote\)\)/)
  assert.match(service, /remote\.pinned/)
  assert.match(service, /remote\.manualOrder/)
  assert.match(service, /Elige una versión para no inventar una mezcla/)
})

test('legacy conflict center remains implemented but is deferred with sync from the rebuild milestone', () => {
  const app = readFileSync('src/app/App.tsx', 'utf8')
  const center = readFileSync('src/features/sync/ConflictCenter.tsx', 'utf8')

  assert.match(app, /<RebuildApp onLock=\{lockVault\} \/>/)
  assert.doesNotMatch(app, /ConflictCenter|setWorkspaceRevision/)
  assert.match(center, /scanSyncConflicts/)
  assert.match(center, /resolveSyncConflict/)
  assert.match(center, /oanix:sync-status/)
  assert.match(center, /oanix:conflict-resolved/)
})
