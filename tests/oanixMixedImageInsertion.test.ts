import assert from 'node:assert/strict'
import test from 'node:test'
import type { EditorSurfaceAttachment, EditorSurfaceBlockChangeSet } from '../src/features/editor/editorSurfaceContract.ts'
import {
  insertOanixImageIntoMixedDocument,
  planOanixMixedImageInsertion,
} from '../src/features/editor/oanixMixedImageInsertion.ts'
import { encodeOanixImageElement } from '../src/features/editor/oanixImageElementCodec.ts'
import { encodeTextBlock } from '../src/features/editor/textBlockCodec.ts'

const attachment: EditorSurfaceAttachment = {
  id: 'asset-new',
  name: 'second.png',
  mimeType: 'image/png',
  byteLength: 6,
  createdAt: '2026-09-03T08:30:00.000Z',
  remote: false,
}

const blocks = [
  encodeTextBlock({ id: 'text-a', kind: 'text-segment', text: 'primero' }),
  encodeOanixImageElement({ id: 'image-old', kind: 'oanix-image-element-v1', attachmentId: 'asset-old', widthPercent: 100, sizeLocked: false }),
  encodeTextBlock({ id: 'text-b', kind: 'text-segment', text: 'hola mundo' }),
]

function ids(kind: 'text' | 'image', index: number): string {
  if (kind === 'image') return 'image-new'
  return index === 0 ? 'text-before' : 'text-after'
}

test('mixed image planner replaces only the targeted text segment and preserves surrounding order', () => {
  const plan = planOanixMixedImageInsertion({
    blocks,
    targetTextBlockId: 'text-b',
    cursorOffset: 5,
    attachmentId: attachment.id,
    createId: ids,
  })

  assert.deepEqual(plan.order, ['text-a', 'image-old', 'text-before', 'image-new', 'text-after'])
  assert.equal(plan.blocks[0], blocks[0])
  assert.equal(plan.blocks[1], blocks[1])
  assert.deepEqual(plan.blocks[2].data, { text: 'hola ' })
  assert.deepEqual(plan.blocks[3].data, { attachmentId: attachment.id, widthPercent: 100, sizeLocked: false })
  assert.deepEqual(plan.blocks[4].data, { text: 'mundo' })
  assert.deepEqual(plan.upserts.map((block) => block.id), ['text-before', 'image-new', 'text-after'])
  assert.deepEqual(plan.deletes, ['text-b'])
})

test('mixed image planner clamps the cursor and leaves a writable trailing segment', () => {
  const plan = planOanixMixedImageInsertion({
    blocks,
    targetTextBlockId: 'text-b',
    cursorOffset: 99,
    attachmentId: attachment.id,
    createId: ids,
  })

  assert.deepEqual(plan.blocks[2].data, { text: 'hola mundo' })
  assert.deepEqual(plan.blocks[4].data, { text: '' })
})

test('mixed image planner respects textarea UTF-16 selection offsets', () => {
  const unicodeBlocks = [
    encodeTextBlock({ id: 'unicode', kind: 'text-segment', text: 'A😀BC' }),
  ]
  const plan = planOanixMixedImageInsertion({
    blocks: unicodeBlocks,
    targetTextBlockId: 'unicode',
    cursorOffset: 3,
    attachmentId: attachment.id,
    createId: ids,
  })

  assert.deepEqual(plan.blocks[0].data, { text: 'A😀' })
  assert.deepEqual(plan.blocks[2].data, { text: 'BC' })
})

test('mixed image planner can insert again without rewriting the existing image or preceding text', () => {
  const first = planOanixMixedImageInsertion({
    blocks,
    targetTextBlockId: 'text-b',
    cursorOffset: 5,
    attachmentId: attachment.id,
    createId: ids,
  })

  const second = planOanixMixedImageInsertion({
    blocks: first.blocks,
    targetTextBlockId: first.afterTextBlockId,
    cursorOffset: 2,
    attachmentId: 'asset-third',
    createId: (kind, index) => kind === 'image' ? 'image-third' : index === 0 ? 'text-third-before' : 'text-third-after',
  })

  assert.deepEqual(second.order, [
    'text-a',
    'image-old',
    'text-before',
    'image-new',
    'text-third-before',
    'image-third',
    'text-third-after',
  ])
  assert.equal(second.blocks[0], first.blocks[0])
  assert.equal(second.blocks[1], first.blocks[1])
  assert.equal(second.blocks[2], first.blocks[2])
  assert.equal(second.blocks[3], first.blocks[3])
  assert.deepEqual(second.blocks[4].data, { text: 'mu' })
  assert.deepEqual(second.blocks[6].data, { text: 'ndo' })
  assert.deepEqual(second.deletes, ['text-after'])
})

test('mixed image coordinator stores once and commits one incremental change set', async () => {
  const events: string[] = []
  let savedChanges: EditorSurfaceBlockChangeSet | null = null

  const result = await insertOanixImageIntoMixedDocument({
    file: new File(['second'], 'second.png', { type: 'image/png' }),
    blocks,
    targetTextBlockId: 'text-b',
    cursorOffset: 5,
    storeAttachment: async () => { events.push('store'); return attachment },
    saveBlockChanges: async (changes) => { events.push('blocks'); savedChanges = changes; return true },
    removeAttachment: async () => { events.push('remove'); return true },
    createId: ids,
  })

  assert.equal(result.status, 'committed')
  assert.deepEqual(events, ['store', 'blocks'])
  assert.deepEqual(savedChanges?.order, ['text-a', 'image-old', 'text-before', 'image-new', 'text-after'])
  assert.deepEqual(savedChanges?.upserts?.map((block) => block.id), ['text-before', 'image-new', 'text-after'])
  assert.deepEqual(savedChanges?.deletes, ['text-b'])
})

test('mixed image coordinator compensates the stored asset when block commit fails', async () => {
  let removedId = ''
  const result = await insertOanixImageIntoMixedDocument({
    file: new File(['second'], 'second.png', { type: 'image/png' }),
    blocks,
    targetTextBlockId: 'text-b',
    cursorOffset: 5,
    storeAttachment: async () => attachment,
    saveBlockChanges: async () => false,
    removeAttachment: async (id) => { removedId = id; return true },
    createId: ids,
  })

  assert.equal(result.status, 'block-save-failed')
  if (result.status !== 'block-save-failed') throw new Error('unexpected result')
  assert.equal(result.attachmentCleanupSucceeded, true)
  assert.equal(removedId, attachment.id)
})

test('mixed image coordinator reports cleanup debt instead of claiming rollback succeeded', async () => {
  const result = await insertOanixImageIntoMixedDocument({
    file: new File(['second'], 'second.png', { type: 'image/png' }),
    blocks,
    targetTextBlockId: 'missing',
    cursorOffset: 0,
    storeAttachment: async () => attachment,
    saveBlockChanges: async () => { throw new Error('must not run') },
    removeAttachment: async () => false,
    createId: ids,
  })

  assert.equal(result.status, 'block-save-failed')
  if (result.status !== 'block-save-failed') throw new Error('unexpected result')
  assert.equal(result.attachmentCleanupSucceeded, false)
})
