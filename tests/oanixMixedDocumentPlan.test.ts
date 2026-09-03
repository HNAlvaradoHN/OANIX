import assert from 'node:assert/strict'
import test from 'node:test'
import { decodeOanixImageElement } from '../src/features/editor/oanixImageElementCodec.ts'
import { planOanixMixedDocumentImageInsertion } from '../src/features/editor/oanixMixedDocumentPlan.ts'
import { decodeTextBlock, MAX_TEXT_BLOCK_TEXT_LENGTH } from '../src/features/editor/textBlockCodec.ts'

function deterministicId(kind: 'text' | 'image', index: number): string {
  return `${kind}-${index}`
}

test('mixed image insertion preserves all text around the native cursor', () => {
  const source = 'antes🙂después'
  const cursorOffset = 'antes🙂'.length
  const plan = planOanixMixedDocumentImageInsertion({
    text: source,
    cursorOffset,
    attachmentId: 'asset-123',
    createId: deterministicId,
  })

  assert.equal(plan.beforeText + plan.afterText, source)
  assert.deepEqual(plan.order, plan.blocks.map((block) => block.id))
  assert.equal(plan.imageBlockId, 'image-0')

  const firstText = decodeTextBlock(plan.blocks[0])
  const image = decodeOanixImageElement(plan.blocks[1])
  const lastText = decodeTextBlock(plan.blocks[2])

  assert.equal(firstText?.text, 'antes🙂')
  assert.equal(image?.attachmentId, 'asset-123')
  assert.equal(lastText?.text, 'después')
})

test('mixed image insertion keeps writable text segments on both sides at document edges', () => {
  const start = planOanixMixedDocumentImageInsertion({
    text: 'abc',
    cursorOffset: 0,
    attachmentId: 'asset-start',
    createId: deterministicId,
  })
  const end = planOanixMixedDocumentImageInsertion({
    text: 'abc',
    cursorOffset: 3,
    attachmentId: 'asset-end',
    createId: deterministicId,
  })

  assert.equal(decodeTextBlock(start.blocks[0])?.text, '')
  assert.equal(decodeTextBlock(start.blocks[2])?.text, 'abc')
  assert.equal(decodeTextBlock(end.blocks[0])?.text, 'abc')
  assert.equal(decodeTextBlock(end.blocks[2])?.text, '')
})

test('mixed image insertion chunks very large text without exceeding text block limits', () => {
  const source = `${'a'.repeat(MAX_TEXT_BLOCK_TEXT_LENGTH + 7)}${'b'.repeat(MAX_TEXT_BLOCK_TEXT_LENGTH + 11)}`
  const cursorOffset = MAX_TEXT_BLOCK_TEXT_LENGTH + 7
  const plan = planOanixMixedDocumentImageInsertion({
    text: source,
    cursorOffset,
    attachmentId: 'asset-large',
    createId: deterministicId,
  })

  const textBlocks = plan.blocks.flatMap((block) => {
    const decoded = decodeTextBlock(block)
    return decoded ? [decoded] : []
  })

  assert.equal(textBlocks.map((block) => block.text).join(''), source)
  assert.ok(textBlocks.every((block) => block.text.length <= MAX_TEXT_BLOCK_TEXT_LENGTH))
  assert.equal(plan.blocks.filter((block) => decodeOanixImageElement(block)).length, 1)
})

test('mixed image insertion refuses an empty attachment identity', () => {
  assert.throws(() => planOanixMixedDocumentImageInsertion({
    text: 'abc',
    cursorOffset: 1,
    attachmentId: '',
    createId: deterministicId,
  }), /attachment id/i)
})
