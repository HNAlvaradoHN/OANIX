import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_REPLICA_IMAGE_DESCRIPTION,
  REPLICA_ATTACHMENT_PRESENTATION_KIND,
  createReplicaAttachmentPresentation,
  decodeReplicaAttachmentPresentation,
  encodeReplicaAttachmentPresentation,
} from '../src/features/editor/replicaAttachmentPresentationCodec.ts'

test('replica attachment presentation persists only small visual metadata', () => {
  const created = createReplicaAttachmentPresentation('asset-123')
  const encoded = encodeReplicaAttachmentPresentation({
    ...created,
    widthPercent: 71,
    alignment: 'right',
    locked: false,
    showName: false,
    description: 'Descripción visible',
  })

  assert.equal(encoded.kind, REPLICA_ATTACHMENT_PRESENTATION_KIND)
  assert.deepEqual(Object.keys(encoded.data).sort(), [
    'alignment',
    'attachmentId',
    'description',
    'locked',
    'showName',
    'widthPercent',
  ])
  assert.equal(encoded.data.attachmentId, 'asset-123')
  assert.equal(encoded.data.widthPercent, 71)
  assert.equal(encoded.data.alignment, 'right')
  assert.equal(encoded.data.locked, false)
  assert.equal(encoded.data.showName, false)
  assert.equal(encoded.data.description, 'Descripción visible')
})

test('replica attachment presentation sanitizes untrusted persisted values', () => {
  const decoded = decodeReplicaAttachmentPresentation({
    id: 'layout-1',
    kind: REPLICA_ATTACHMENT_PRESENTATION_KIND,
    data: {
      attachmentId: 'asset-1',
      widthPercent: 999,
      alignment: 'diagonal',
      locked: 'yes',
      showName: null,
      description: 'x'.repeat(MAX_REPLICA_IMAGE_DESCRIPTION + 40),
    },
  })

  assert.ok(decoded)
  assert.equal(decoded.widthPercent, 100)
  assert.equal(decoded.alignment, 'center')
  assert.equal(decoded.locked, true)
  assert.equal(decoded.showName, true)
  assert.equal(decoded.description.length, MAX_REPLICA_IMAGE_DESCRIPTION)
})

test('replica attachment presentation ignores unrelated or malformed blocks', () => {
  assert.equal(decodeReplicaAttachmentPresentation({ id: 'x', kind: 'text-v1', data: {} }), null)
  assert.equal(decodeReplicaAttachmentPresentation({
    id: 'x',
    kind: REPLICA_ATTACHMENT_PRESENTATION_KIND,
    data: { attachmentId: '', description: '' },
  }), null)
})
