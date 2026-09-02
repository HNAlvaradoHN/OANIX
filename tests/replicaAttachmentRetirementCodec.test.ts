import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_REPLICA_RETIRED_ATTACHMENT_ID,
  REPLICA_ATTACHMENT_RETIREMENT_KIND,
  createReplicaAttachmentRetirement,
  decodeReplicaAttachmentRetirement,
  encodeReplicaAttachmentRetirement,
} from '../src/features/editor/replicaAttachmentRetirementCodec.ts'

test('replica attachment retirement stores only opaque attachment identity', () => {
  const encoded = encodeReplicaAttachmentRetirement({
    id: 'retirement-1',
    kind: REPLICA_ATTACHMENT_RETIREMENT_KIND,
    attachmentId: 'attachment-1',
  })

  assert.deepEqual(encoded, {
    id: 'retirement-1',
    kind: REPLICA_ATTACHMENT_RETIREMENT_KIND,
    data: { attachmentId: 'attachment-1' },
  })
  assert.equal(JSON.stringify(encoded).includes('blob:'), false)
  assert.equal(JSON.stringify(encoded).includes('base64'), false)
  assert.equal(JSON.stringify(encoded).includes('provider'), false)
})

test('replica attachment retirement clamps ids and rejects malformed blocks', () => {
  const longId = 'x'.repeat(MAX_REPLICA_RETIRED_ATTACHMENT_ID + 20)
  const encoded = encodeReplicaAttachmentRetirement({
    id: 'retirement-2',
    kind: REPLICA_ATTACHMENT_RETIREMENT_KIND,
    attachmentId: longId,
  })
  assert.equal(decodeReplicaAttachmentRetirement(encoded)?.attachmentId.length, MAX_REPLICA_RETIRED_ATTACHMENT_ID)
  assert.equal(decodeReplicaAttachmentRetirement({ id: 'x', kind: 'other', data: {} }), null)
  assert.equal(decodeReplicaAttachmentRetirement({ id: 'x', kind: REPLICA_ATTACHMENT_RETIREMENT_KIND, data: {} }), null)
})

test('replica attachment retirement creates an isolated hidden record', () => {
  const retirement = createReplicaAttachmentRetirement('attachment-2')
  assert.match(retirement.id, /^attachment-retirement-/)
  assert.equal(retirement.kind, REPLICA_ATTACHMENT_RETIREMENT_KIND)
  assert.equal(retirement.attachmentId, 'attachment-2')
})
