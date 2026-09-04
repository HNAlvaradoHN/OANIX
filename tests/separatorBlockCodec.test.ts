import assert from 'node:assert/strict'
import test from 'node:test'
import { decodeSeparatorBlock, encodeSeparatorBlock, SEPARATOR_BLOCK_KIND } from '../src/features/editor/separatorBlockCodec.ts'

test('separator block codec round-trips the minimal structural block', () => {
  const encoded = encodeSeparatorBlock({ id: 'separator-1', kind: SEPARATOR_BLOCK_KIND })
  assert.deepEqual(encoded, { id: 'separator-1', kind: SEPARATOR_BLOCK_KIND, data: {} })
  assert.deepEqual(decodeSeparatorBlock(encoded), { id: 'separator-1', kind: SEPARATOR_BLOCK_KIND })
})

test('separator decoder rejects unrelated block kinds', () => {
  assert.equal(decodeSeparatorBlock({ id: 'text-1', kind: 'text-segment', data: { text: '' } }), null)
})
