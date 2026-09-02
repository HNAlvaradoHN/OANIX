import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_REPLICA_FLOW_ATTACHMENT_ID,
  REPLICA_ATTACHMENT_FLOW_KIND,
  createReplicaAttachmentFlowRef,
  decodeReplicaAttachmentFlowRef,
  encodeReplicaAttachmentFlowRef,
} from '../src/features/editor/replicaAttachmentFlowCodec.ts'

test('replica attachment flow ref stores only opaque identity and flow type', () => {
  const created = createReplicaAttachmentFlowRef('asset-123', 'image')
  const encoded = encodeReplicaAttachmentFlowRef(created)

  assert.equal(encoded.kind, REPLICA_ATTACHMENT_FLOW_KIND)
  assert.deepEqual(Object.keys(encoded.data).sort(), ['attachmentId', 'attachmentType'])
  assert.equal(encoded.data.attachmentId, 'asset-123')
  assert.equal(encoded.data.attachmentType, 'image')
  assert.equal('blob' in encoded.data, false)
  assert.equal('url' in encoded.data, false)
  assert.equal('base64' in encoded.data, false)
})

test('replica attachment flow ref round-trips image and file anchors', () => {
  for (const attachmentType of ['image', 'file'] as const) {
    const encoded = encodeReplicaAttachmentFlowRef({
      id: `flow-${attachmentType}`,
      kind: REPLICA_ATTACHMENT_FLOW_KIND,
      attachmentId: `asset-${attachmentType}`,
      attachmentType,
    })
    assert.deepEqual(decodeReplicaAttachmentFlowRef(encoded), {
      id: `flow-${attachmentType}`,
      kind: REPLICA_ATTACHMENT_FLOW_KIND,
      attachmentId: `asset-${attachmentType}`,
      attachmentType,
    })
  }
})

test('replica attachment flow ref bounds ids and rejects malformed data', () => {
  const oversized = 'x'.repeat(MAX_REPLICA_FLOW_ATTACHMENT_ID + 20)
  const encoded = encodeReplicaAttachmentFlowRef({
    id: 'flow-long',
    kind: REPLICA_ATTACHMENT_FLOW_KIND,
    attachmentId: oversized,
    attachmentType: 'file',
  })
  assert.equal(String(encoded.data.attachmentId).length, MAX_REPLICA_FLOW_ATTACHMENT_ID)

  assert.equal(decodeReplicaAttachmentFlowRef({ id: 'x', kind: 'text-v1', data: {} }), null)
  assert.equal(decodeReplicaAttachmentFlowRef({
    id: 'x',
    kind: REPLICA_ATTACHMENT_FLOW_KIND,
    data: { attachmentId: '', attachmentType: 'image' },
  }), null)
  assert.equal(decodeReplicaAttachmentFlowRef({
    id: 'x',
    kind: REPLICA_ATTACHMENT_FLOW_KIND,
    data: { attachmentId: 'asset-1', attachmentType: 'video' },
  }), null)
})
