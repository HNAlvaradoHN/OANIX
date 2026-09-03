import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_OANIX_ATTACHMENT_ID_LENGTH,
  OANIX_IMAGE_ELEMENT_KIND,
  decodeOanixImageElement,
  encodeOanixImageElement,
} from '../src/features/editor/oanixImageElementCodec.ts'

test('image element stores only an opaque attachment reference', () => {
  const encoded = encodeOanixImageElement({
    id: 'image-block-1',
    kind: OANIX_IMAGE_ELEMENT_KIND,
    attachmentId: 'attachment-1',
  })

  assert.deepEqual(encoded, {
    id: 'image-block-1',
    kind: OANIX_IMAGE_ELEMENT_KIND,
    data: { attachmentId: 'attachment-1' },
  })
  assert.equal('file' in encoded.data, false)
  assert.equal('url' in encoded.data, false)
  assert.equal('blob' in encoded.data, false)
  assert.equal('base64' in encoded.data, false)
})

test('image element decoder rejects malformed identity and bounds attachment ids', () => {
  assert.equal(decodeOanixImageElement({
    id: 'bad',
    kind: OANIX_IMAGE_ELEMENT_KIND,
    data: { attachmentId: '' },
  }), null)

  const longId = 'a'.repeat(MAX_OANIX_ATTACHMENT_ID_LENGTH + 50)
  const decoded = decodeOanixImageElement({
    id: 'bounded',
    kind: OANIX_IMAGE_ELEMENT_KIND,
    data: { attachmentId: longId },
  })
  assert.equal(decoded?.attachmentId.length, MAX_OANIX_ATTACHMENT_ID_LENGTH)
})
