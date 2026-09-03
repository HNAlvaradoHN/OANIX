import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  EditorSurfaceAttachment,
  EditorSurfaceBlockChangeSet,
  EditorSurfaceSnapshot,
} from '../src/features/editor/editorSurfaceContract.ts'
import {
  insertOanixLongTextIntoPlainDocument,
  planOanixPlainLongTextInsertion,
} from '../src/features/editor/oanixPlainLongTextInsertion.ts'
import { OANIX_LONG_TEXT_ELEMENT_KIND } from '../src/features/editor/oanixLongTextElementCodec.ts'
import { MAX_TEXT_BLOCK_TEXT_LENGTH } from '../src/features/editor/textBlockCodec.ts'

const attachment: EditorSurfaceAttachment = {
  id: 'asset-long',
  name: 'texto-largo.txt',
  mimeType: 'text/plain;charset=utf-8',
  byteLength: 300_000,
  createdAt: '2026-09-03T12:40:00.000Z',
  remote: false,
}

function ids(kind: 'text' | 'long-text', index: number): string {
  if (kind === 'long-text') return 'long-text'
  return `text-${index}`
}

test('plain long-text planner preserves cursor text and chunks large surrounding text', () => {
  const before = 'a'.repeat(MAX_TEXT_BLOCK_TEXT_LENGTH + 7)
  const sourceText = `${before}🙂después`
  const pastedText = 'z'.repeat(140_000)
  const plan = planOanixPlainLongTextInsertion({
    sourceText,
    cursorOffset: before.length,
    pastedText,
    attachmentId: attachment.id,
    lines: null,
    createId: ids,
  })

  assert.equal(plan.blocks.length, 4)
  assert.equal(plan.blocks[0].data.text.length, MAX_TEXT_BLOCK_TEXT_LENGTH)
  assert.equal(plan.blocks[1].data.text, 'a'.repeat(7))
  assert.equal(plan.blocks[2].kind, OANIX_LONG_TEXT_ELEMENT_KIND)
  assert.equal(plan.blocks[2].data.attachmentId, attachment.id)
  assert.equal(plan.blocks[2].data.utf16Length, pastedText.length)
  assert.equal('text' in plan.blocks[2].data, false)
  assert.equal(plan.blocks[3].data.text, '🙂después')
  assert.deepEqual(plan.order, plan.blocks.map((block) => block.id))
  assert.equal(plan.afterTextBlockId, plan.blocks[3].id)
})

test('normal paste remains native and stores no attachment', async () => {
  let stored = false
  const result = await insertOanixLongTextIntoPlainDocument({
    pastedText: 'texto normal',
    title: 'Nota',
    sourceText: 'antes después',
    cursorOffset: 6,
    existingBlocks: [],
    storeAttachment: async () => { stored = true; return attachment },
    saveBlockChanges: async () => true,
    savePlainSnapshot: async () => true,
    removeAttachment: async () => true,
    createFile: () => ({}) as File,
  })

  assert.deepEqual(result, { status: 'not-large-text' })
  assert.equal(stored, false)
})

test('first large paste keeps plain text until blocks commit then clears it', async () => {
  const operations: string[] = []
  let blockChanges: EditorSurfaceBlockChangeSet | null = null
  let plainSnapshot: EditorSurfaceSnapshot | null = null

  const result = await insertOanixLongTextIntoPlainDocument({
    pastedText: 'x'.repeat(140_000),
    title: 'Nota segura',
    sourceText: 'antes después',
    cursorOffset: 6,
    existingBlocks: [],
    storeAttachment: async () => { operations.push('store'); return attachment },
    saveBlockChanges: async (changes) => { operations.push('blocks'); blockChanges = changes; return true },
    savePlainSnapshot: async (snapshot) => { operations.push('plain'); plainSnapshot = snapshot; return true },
    removeAttachment: async () => { operations.push('remove'); return true },
    createId: ids,
    createFile: () => ({ name: 'texto-largo.txt' }) as File,
  })

  assert.equal(result.status, 'committed')
  assert.deepEqual(operations, ['store', 'blocks', 'plain'])
  assert.deepEqual(plainSnapshot, { title: 'Nota segura', text: '' })
  assert.equal(blockChanges?.deletes, undefined)
  assert.equal(blockChanges?.order?.includes('long-text'), true)
})

test('existing hidden blocks block migration and clean the new attachment', async () => {
  const operations: string[] = []
  const result = await insertOanixLongTextIntoPlainDocument({
    pastedText: 'x'.repeat(140_000),
    title: 'Nota',
    sourceText: 'texto',
    cursorOffset: 2,
    existingBlocks: [{ id: 'legacy', kind: 'unknown', data: {} }],
    storeAttachment: async () => { operations.push('store'); return attachment },
    saveBlockChanges: async () => { operations.push('blocks'); return true },
    savePlainSnapshot: async () => { operations.push('plain'); return true },
    removeAttachment: async (id) => { operations.push(`remove:${id}`); return true },
    createFile: () => ({}) as File,
  })

  assert.equal(result.status, 'blocked-existing-blocks')
  if (result.status === 'blocked-existing-blocks') assert.equal(result.attachmentCleanupSucceeded, true)
  assert.deepEqual(operations, ['store', 'remove:asset-long'])
})

test('plain clear failure rolls blocks back before removing attachment', async () => {
  const operations: string[] = []
  let saveCount = 0
  const result = await insertOanixLongTextIntoPlainDocument({
    pastedText: 'x'.repeat(140_000),
    title: 'Nota',
    sourceText: 'texto',
    cursorOffset: 2,
    existingBlocks: [],
    storeAttachment: async () => { operations.push('store'); return attachment },
    saveBlockChanges: async (changes) => {
      saveCount += 1
      operations.push(saveCount === 1 ? 'blocks' : `rollback:${changes.deletes?.length ?? 0}`)
      return true
    },
    savePlainSnapshot: async () => { operations.push('plain'); return false },
    removeAttachment: async (id) => { operations.push(`remove:${id}`); return true },
    createId: ids,
    createFile: () => ({}) as File,
  })

  assert.equal(result.status, 'plain-save-failed')
  if (result.status === 'plain-save-failed') {
    assert.equal(result.blockRollbackSucceeded, true)
    assert.equal(result.attachmentCleanupSucceeded, true)
  }
  assert.deepEqual(operations, ['store', 'blocks', 'plain', 'rollback:3', 'remove:asset-long'])
})

test('failed rollback preserves attachment because references may remain', async () => {
  let removed = false
  let saveCount = 0
  const result = await insertOanixLongTextIntoPlainDocument({
    pastedText: 'x'.repeat(140_000),
    title: 'Nota',
    sourceText: 'texto',
    cursorOffset: 2,
    existingBlocks: [],
    storeAttachment: async () => attachment,
    saveBlockChanges: async () => { saveCount += 1; return saveCount === 1 },
    savePlainSnapshot: async () => false,
    removeAttachment: async () => { removed = true; return true },
    createId: ids,
    createFile: () => ({}) as File,
  })

  assert.equal(result.status, 'plain-save-failed')
  if (result.status === 'plain-save-failed') {
    assert.equal(result.blockRollbackSucceeded, false)
    assert.equal(result.attachmentCleanupSucceeded, null)
  }
  assert.equal(removed, false)
})
