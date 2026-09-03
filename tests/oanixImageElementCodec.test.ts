import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_OANIX_IMAGE_WIDTH_PERCENT,
  MAX_OANIX_ATTACHMENT_ID_LENGTH,
  MAX_OANIX_IMAGE_WIDTH_PERCENT,
  MIN_OANIX_IMAGE_WIDTH_PERCENT,
  OANIX_IMAGE_ELEMENT_KIND,
  decodeOanixImageElement,
  encodeOanixImageElement,
} from '../src/features/editor/oanixImageElementCodec.ts'

test('image element stores only opaque reference and compact presentation metadata', () => {
  const encoded = encodeOanixImageElement({
    id: 'image-block-1',
    kind: OANIX_IMAGE_ELEMENT_KIND,
    attachmentId: 'attachment-1',
    widthPercent: 72,
    sizeLocked: true,
  })

  assert.deepEqual(encoded, {
    id: 'image-block-1',
    kind: OANIX_IMAGE_ELEMENT_KIND,
    data: {
      attachmentId: 'attachment-1',
      widthPercent: 72,
      sizeLocked: true,
    },
  })
  assert.equal('file' in encoded.data, false)
  assert.equal('url' in encoded.data, false)
  assert.equal('blob' in encoded.data, false)
  assert.equal('base64' in encoded.data, false)
})

test('image element decoder remains compatible with old blocks and bounds presentation values', () => {
  assert.equal(decodeOanixImageElement({
    id: 'bad',
    kind: OANIX_IMAGE_ELEMENT_KIND,
    data: { attachmentId: '' },
  }), null)

  const legacy = decodeOanixImageElement({
    id: 'legacy',
    kind: OANIX_IMAGE_ELEMENT_KIND,
    data: { attachmentId: 'attachment-legacy' },
  })
  assert.equal(legacy?.widthPercent, DEFAULT_OANIX_IMAGE_WIDTH_PERCENT)
  assert.equal(legacy?.sizeLocked, false)

  const tooLarge = decodeOanixImageElement({
    id: 'large',
    kind: OANIX_IMAGE_ELEMENT_KIND,
    data: { attachmentId: 'attachment-large', widthPercent: 999, sizeLocked: true },
  })
  assert.equal(tooLarge?.widthPercent, MAX_OANIX_IMAGE_WIDTH_PERCENT)
  assert.equal(tooLarge?.sizeLocked, true)

  const tooSmall = decodeOanixImageElement({
    id: 'small',
    kind: OANIX_IMAGE_ELEMENT_KIND,
    data: { attachmentId: 'attachment-small', widthPercent: 1 },
  })
  assert.equal(tooSmall?.widthPercent, MIN_OANIX_IMAGE_WIDTH_PERCENT)

  const longId = 'a'.repeat(MAX_OANIX_ATTACHMENT_ID_LENGTH + 50)
  const decoded = decodeOanixImageElement({
    id: 'bounded',
    kind: OANIX_IMAGE_ELEMENT_KIND,
    data: { attachmentId: longId },
  })
  assert.equal(decoded?.attachmentId.length, MAX_OANIX_ATTACHMENT_ID_LENGTH)
})
