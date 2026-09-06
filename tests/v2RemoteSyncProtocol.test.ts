import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canApplyRemoteChange,
  pendingNeedsUpload,
  requireSyncV2RemoteRow,
  syncV2IdentityKey,
  type SyncV2BindingRecord,
  type SyncV2RemoteRow,
} from '../src/features/sync/v2RemoteSyncProtocol.ts'

const row: SyncV2RemoteRow = {
  record_key: 'opaque-record',
  object_key: 'opaque-object',
  revision: 4,
  deleted: false,
  content_sha256: 'hash',
  content_bytes: 120,
  change_seq: 18,
}

const binding: SyncV2BindingRecord = {
  version: 2,
  unitType: 'note.v2.text-chunk',
  unitId: 'note:chunk',
  recordKey: 'opaque-record',
  objectKey: 'previous-object',
  revision: 3,
  remoteChangeSeq: 17,
}

test('pending ya reconocido no vuelve a producir upload', () => {
  assert.equal(
    pendingNeedsUpload(
      { revision: 7, operation: 'upsert' },
      {
        version: 2,
        unitType: 'note.v2.meta',
        unitId: 'n1',
        revision: 7,
        operation: 'upsert',
        remoteChangeSeq: 9,
        acknowledgedAt: '2026-09-05T00:00:00.000Z',
      },
    ),
    false,
  )
})

test('una revisión nueva produce exactamente trabajo pendiente', () => {
  assert.equal(
    pendingNeedsUpload(
      { revision: 8, operation: 'upsert' },
      {
        version: 2,
        unitType: 'note.v2.meta',
        unitId: 'n1',
        revision: 7,
        operation: 'upsert',
        remoteChangeSeq: 9,
        acknowledgedAt: '2026-09-05T00:00:00.000Z',
      },
    ),
    true,
  )
})

test('un cambio remoto nuevo se aplica sin volver a bajar un self-write reconocido', () => {
  assert.equal(canApplyRemoteChange({ ...row, change_seq: 17 }, binding, false), 'skip-self')
  assert.equal(canApplyRemoteChange(row, binding, false), 'apply')
})

test('un cambio remoto no pisa una unidad local todavía sucia', () => {
  assert.equal(canApplyRemoteChange(row, binding, true), 'conflict')
})

test('la identidad local nunca se usa como object key por accidente', () => {
  assert.equal(syncV2IdentityKey('note.v2.meta', 'note-id'), '["note.v2.meta","note-id"]')
  assert.notEqual(syncV2IdentityKey('note.v2.meta', 'note-id'), row.object_key)
})

test('rechaza metadata remota incompleta antes de tocar contenido local', () => {
  assert.throws(() => requireSyncV2RemoteRow({ ...row, change_seq: 0 }), /metadata v2 inválida/)
  assert.deepEqual(requireSyncV2RemoteRow(row), row)
})
