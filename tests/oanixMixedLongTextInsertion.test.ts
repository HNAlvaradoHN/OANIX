import assert from 'node:assert/strict'
import test from 'node:test'
import type { EditorSurfaceAttachment, EditorSurfaceBlockChangeSet } from '../src/features/editor/editorSurfaceContract.ts'
import {
  insertOanixLongTextIntoMixedDocument,
  planOanixMixedLongTextInsertion,
} from '../src/features/editor/oanixMixedLongTextInsertion.ts'
import { OANIX_LONG_TEXT_ELEMENT_KIND } from '../src/features/editor/oanixLongTextElementCodec.ts'
import { encodeTextBlock } from '../src/features/editor/textBlockCodec.ts'

const blocks = [
  encodeTextBlock({ id: 'before-existing', kind: 'text-segment', text: 'uno' }),
  encodeTextBlock({ id: 'target', kind: 'text-segment', text: 'hola mundo' }),
]

const attachment: EditorSurfaceAttachment = {
  id: 'asset-long',
  name: 'texto-largo.txt',
  mimeType: 'text/plain;charset=utf-8',
  byteLength: 300_000,
  createdAt: '2026-09-03T10:00:00.000Z',
  remote: false,
}

function ids(kind: 'text' | 'long-text', index: number): string {
  if (kind === 'long-text') return 'long-text'
  return index === 0 ? 'text-before' : 'text-after'
}

test('long-text planner replaces only target segment and keeps payload outside block', () => {
  const largeText = 'z'.repeat(140_000)
  const plan = planOanixMixedLongTextInsertion({
    blocks,
    targetTextBlockId: 'target',
    cursorOffset: 5,
    attachmentId: attachment.id,
    text: largeText,
    lines: null,
    createId: ids,
  })

  assert.deepEqual(plan.order, ['before-existing', 'text-before', 'long-text', 'text-after'])
  assert.equal(plan.blocks[0], blocks[0])
  assert.deepEqual(plan.blocks[1].data, { text: 'hola ' })
  assert.equal(plan.blocks[2].kind, OANIX_LONG_TEXT_ELEMENT_KIND)
  assert.equal(plan.blocks[2].data.attachmentId, attachment.id)
  assert.equal(plan.blocks[2].data.utf16Length, largeText.length)
  assert.equal('text' in plan.blocks[2].data, false)
  assert.deepEqual(plan.blocks[3].data, { text: 'mundo' })
  assert.deepEqual(plan.deletes, ['target'])
})

test('normal text is not converted into a long-text element', async () => {
  let stored = false
  const result = await insertOanixLongTextIntoMixedDocument({
    text: 'texto normal',
    blocks,
    targetTextBlockId: 'target',
    cursorOffset: 0,
    storeAttachment: async () => { stored = true; return attachment },
    saveBlockChanges: async () => true,
    removeAttachment: async () => true,
    createFile: () => ({}) as File,
  })

  assert.deepEqual(result, { status: 'not-large-text' })
  assert.equal(stored, false)
})

test('large paste stores attachment then commits one atomic block change-set', async () => {
  const operations: string[] = []
  let changes: EditorSurfaceBlockChangeSet | null = null
  const largeText = 'x'.repeat(140_000)

  const result = await insertOanixLongTextIntoMixedDocument({
    text: largeText,
    blocks,
    targetTextBlockId: 'target',
    cursorOffset: 5,
    storeAttachment: async () => { operations.push('store'); return attachment },
    saveBlockChanges: async (next) => { operations.push('blocks'); changes = next; return true },
    removeAttachment: async () => { operations.push('remove'); return true },
    createId: ids,
    createFile: (text) => {
      assert.equal(text, largeText)
      return { name: 'texto-largo.txt' } as File
    },
  })

  assert.equal(result.status, 'committed')
  assert.deepEqual(operations, ['store', 'blocks'])
  assert.deepEqual(changes?.deletes, ['target'])
  assert.deepEqual(changes?.order, ['before-existing', 'text-before', 'long-text', 'text-after'])
})

test('failed block commit compensates the newly stored attachment', async () => {
  const operations: string[] = []
  const result = await insertOanixLongTextIntoMixedDocument({
    text: 'x'.repeat(140_000),
    blocks,
    targetTextBlockId: 'target',
    cursorOffset: 2,
    storeAttachment: async () => { operations.push('store'); return attachment },
    saveBlockChanges: async () => { operations.push('blocks'); return false },
    removeAttachment: async (id) => { operations.push(`remove:${id}`); return true },
    createId: ids,
    createFile: () => ({}) as File,
  })

  assert.equal(result.status, 'block-save-failed')
  if (result.status === 'block-save-failed') assert.equal(result.attachmentCleanupSucceeded, true)
  assert.deepEqual(operations, ['store', 'blocks', 'remove:asset-long'])
})
