import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createEntityPendingWrite,
  currentEntityRevision,
  nextEntityRevision,
} from '../src/features/rebuild/entitySyncWrites'
import { FOLDER_V2_TYPE, SYNC_V2_PENDING_TYPE } from '../src/features/rebuild/rebuildModel'

test('entity sync revisions upgrade legacy records without losing monotonicity', () => {
  assert.equal(currentEntityRevision({}), 1)
  assert.equal(currentEntityRevision({ revision: 0 }), 1)
  assert.equal(currentEntityRevision({ revision: 7 }), 7)
  assert.equal(nextEntityRevision({}), 2)
  assert.equal(nextEntityRevision({ revision: 7 }), 8)
})

test('folder and tag pending writes use the entity as their own sync scope', () => {
  const queuedAt = '2026-09-06T04:00:00.000Z'
  const write = createEntityPendingWrite(FOLDER_V2_TYPE, 'folder-1', 4, 'delete', queuedAt)

  assert.equal(write.recordType, SYNC_V2_PENDING_TYPE)
  assert.deepEqual(write.value, {
    version: 2,
    noteId: 'folder-1',
    unitType: FOLDER_V2_TYPE,
    unitId: 'folder-1',
    revision: 4,
    operation: 'delete',
    queuedAt,
  })
})
