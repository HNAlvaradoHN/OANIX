import assert from 'node:assert/strict'
import test from 'node:test'
import { decideOanixMixedDocumentLoad } from '../src/features/editor/oanixMixedDocumentLoadPolicy.ts'
import { encodeOanixImageElement } from '../src/features/editor/oanixImageElementCodec.ts'
import { encodeTextBlock } from '../src/features/editor/textBlockCodec.ts'

test('empty block set keeps the approved plain editor active', () => {
  assert.deepEqual(decideOanixMixedDocumentLoad('texto', []), {
    mode: 'plain',
    reason: 'no-blocks',
  })
})

test('supported persisted blocks activate mixed mode only when plain body is empty', () => {
  const blocks = [
    encodeTextBlock({ id: 'text-1', kind: 'text-segment', text: 'antes' }),
    encodeOanixImageElement({ id: 'image-1', kind: 'oanix-image-element-v1', attachmentId: 'asset-1' }),
    encodeTextBlock({ id: 'text-2', kind: 'text-segment', text: 'después' }),
  ]

  assert.deepEqual(decideOanixMixedDocumentLoad('', blocks), {
    mode: 'mixed',
    reason: 'supported-blocks',
  })
})

test('plain text plus blocks is treated as recoverable conflict instead of choosing a side', () => {
  const blocks = [encodeTextBlock({ id: 'text-1', kind: 'text-segment', text: 'bloques' })]
  assert.deepEqual(decideOanixMixedDocumentLoad('texto legacy', blocks), {
    mode: 'recoverable-conflict',
    reason: 'plain-and-blocks',
  })
})

test('unknown block kinds block mixed activation without discarding their identity', () => {
  const decision = decideOanixMixedDocumentLoad('', [
    { id: 'future-a', kind: 'future-widget', data: {} },
    { id: 'future-b', kind: 'future-widget', data: {} },
    { id: 'future-c', kind: 'another-widget', data: {} },
  ])

  assert.deepEqual(decision, {
    mode: 'unsupported-blocks',
    reason: 'unknown-block-kind',
    unsupportedKinds: ['future-widget', 'another-widget'],
  })
})
