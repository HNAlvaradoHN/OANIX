import assert from 'node:assert/strict'
import test from 'node:test'
import { encodeOanixImageElement } from '../src/features/editor/oanixImageElementCodec.ts'
import { hasRenderableOanixMixedContent, projectOanixMixedDocument } from '../src/features/editor/oanixMixedDocumentProjection.ts'
import { encodeTextBlock } from '../src/features/editor/textBlockCodec.ts'

test('mixed projection preserves persisted order across text and image nodes', () => {
  const blocks = [
    encodeTextBlock({ id: 'text-a', kind: 'text-segment', text: 'antes' }),
    encodeOanixImageElement({ id: 'image-a', kind: 'oanix-image-element-v1', attachmentId: 'asset-a' }),
    encodeTextBlock({ id: 'text-b', kind: 'text-segment', text: 'después' }),
  ]

  const projected = projectOanixMixedDocument(blocks)
  assert.deepEqual(projected.map((node) => node.type), ['text', 'image', 'text'])
  assert.deepEqual(projected.map((node) => node.block.id), blocks.map((block) => block.id))
})

test('mixed projection never drops unsupported persisted blocks', () => {
  const unknown = { id: 'future-1', kind: 'future-element-v9', data: { value: 'keep-me' } }
  const projected = projectOanixMixedDocument([unknown])

  assert.equal(projected.length, 1)
  assert.equal(projected[0].type, 'unsupported')
  assert.deepEqual(projected[0].block, unknown)
  assert.equal(hasRenderableOanixMixedContent([unknown]), false)
})

test('mixed projection recognizes an empty writable text segment as renderable content', () => {
  const empty = encodeTextBlock({ id: 'text-empty', kind: 'text-segment', text: '' })
  assert.equal(hasRenderableOanixMixedContent([empty]), true)
})
