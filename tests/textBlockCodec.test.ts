import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_TEXT_BLOCK_TEXT_LENGTH,
  TEXT_BLOCK_KIND,
  decodeTextBlock,
  encodeTextBlock,
} from '../src/features/editor/textBlockCodec.ts'

const encoded = encodeTextBlock({
  id: 'text-1',
  kind: TEXT_BLOCK_KIND,
  text: 'Hola\nOANIX',
})

test('text segment codec round-trips plain text only', () => {
  assert.deepEqual(encoded, {
    id: 'text-1',
    kind: TEXT_BLOCK_KIND,
    data: { text: 'Hola\nOANIX' },
  })
  assert.deepEqual(decodeTextBlock(encoded), {
    id: 'text-1',
    kind: TEXT_BLOCK_KIND,
    text: 'Hola\nOANIX',
  })
})

test('text segment codec rejects unrelated, malformed and oversized payloads', () => {
  assert.equal(decodeTextBlock({ id: 'x', kind: 'code', data: { text: 'x' } }), null)
  assert.equal(decodeTextBlock({ id: 'x', kind: TEXT_BLOCK_KIND, data: { text: 1 } }), null)
  assert.equal(decodeTextBlock({
    id: 'x',
    kind: TEXT_BLOCK_KIND,
    data: { text: 'x'.repeat(MAX_TEXT_BLOCK_TEXT_LENGTH + 1) },
  }), null)
})
