import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_REPLICA_RETIRED_ATTACHMENT_ID,
  REPLICA_RETIRED_ATTACHMENT_KIND,
  createReplicaRetiredAttachment,
  decodeReplicaRetiredAttachment,
  encodeReplicaRetiredAttachment,
} from '../src/features/editor/replicaRetiredAttachmentCodec.ts'

test('retired attachment tombstone stores only opaque identity', () => {
  const encoded = encodeReplicaRetiredAttachment(
    createReplicaRetiredAttachment('asset-old-123'),
  )

  assert.equal(encoded.kind, REPLICA_RETIRED_ATTACHMENT_KIND)
  assert.deepEqual(Object.keys(encoded.data), ['attachmentId'])
  assert.equal(encoded.data.attachmentId, 'asset-old-123')
  assert.equal('blob' in encoded.data, false)
  assert.equal('url' in encoded.data, false)
  assert.equal('provider' in encoded.data, false)
})

test('retired attachment tombstone round-trips and bounds ids', () => {
  const oversized = 'x'.repeat(MAX_REPLICA_RETIRED_ATTACHMENT_ID + 40)
  const encoded = encodeReplicaRetiredAttachment({
    id: 'retired-1',
    kind: REPLICA_RETIRED_ATTACHMENT_KIND,
    attachmentId: oversized,
  })

  assert.equal(String(encoded.data.attachmentId).length, MAX_REPLICA_RETIRED_ATTACHMENT_ID)
  assert.deepEqual(decodeReplicaRetiredAttachment(encoded), {
    id: 'retired-1',
    kind: REPLICA_RETIRED_ATTACHMENT_KIND,
    attachmentId: oversized.slice(0, MAX_REPLICA_RETIRED_ATTACHMENT_ID),
  })
})

test('retired attachment tombstone rejects unrelated or malformed blocks', () => {
  assert.equal(decodeReplicaRetiredAttachment({ id: 'x', kind: 'text-v1', data: {} }), null)
  assert.equal(decodeReplicaRetiredAttachment({
    id: 'x',
    kind: REPLICA_RETIRED_ATTACHMENT_KIND,
    data: { attachmentId: '' },
  }), null)
})
