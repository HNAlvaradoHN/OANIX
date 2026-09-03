import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_OANIX_LONG_TEXT_PREVIEW,
  OANIX_LONG_TEXT_ELEMENT_KIND,
  createOanixLongTextPreview,
  decodeOanixLongTextElement,
  encodeOanixLongTextElement,
} from '../src/features/editor/oanixLongTextElementCodec.ts'

test('long-text codec persists only bounded preview and attachment identity', () => {
  const block = encodeOanixLongTextElement({
    id: 'long-1',
    kind: OANIX_LONG_TEXT_ELEMENT_KIND,
    attachmentId: 'asset-text',
    preview: 'x'.repeat(MAX_OANIX_LONG_TEXT_PREVIEW + 100),
    utf16Length: 900_000,
    lines: null,
  })

  assert.equal(block.kind, OANIX_LONG_TEXT_ELEMENT_KIND)
  assert.equal(block.data.attachmentId, 'asset-text')
  assert.equal(typeof block.data.preview, 'string')
  assert.equal((block.data.preview as string).length, MAX_OANIX_LONG_TEXT_PREVIEW)
  assert.equal(block.data.utf16Length, 900_000)
  assert.equal(block.data.lines, null)
  assert.equal('text' in block.data, false)

  assert.deepEqual(decodeOanixLongTextElement(block), {
    id: 'long-1',
    kind: OANIX_LONG_TEXT_ELEMENT_KIND,
    attachmentId: 'asset-text',
    preview: 'x'.repeat(MAX_OANIX_LONG_TEXT_PREVIEW),
    utf16Length: 900_000,
    lines: null,
  })
})

test('long-text preview is bounded and signals truncation', () => {
  const text = 'a'.repeat(MAX_OANIX_LONG_TEXT_PREVIEW + 1)
  const preview = createOanixLongTextPreview(text)
  assert.equal(preview.length, MAX_OANIX_LONG_TEXT_PREVIEW + 1)
  assert.equal(preview.endsWith('…'), true)
})

test('decoder rejects malformed long-text metadata', () => {
  assert.equal(decodeOanixLongTextElement({
    id: 'bad',
    kind: OANIX_LONG_TEXT_ELEMENT_KIND,
    data: { attachmentId: '', preview: '', utf16Length: 1, lines: null },
  }), null)
})
