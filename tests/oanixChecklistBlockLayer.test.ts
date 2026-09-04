import assert from 'node:assert/strict'
import test from 'node:test'
import type { EditorSurfaceBlockChangeSet } from '../src/features/editor/editorSurfaceContract.ts'
import { decodeChecklistBlock } from '../src/features/editor/checklistBlockCodec.ts'
import { insertOanixChecklistBlock } from '../src/features/editor/oanixChecklistBlockLayer.ts'
import { encodeTextBlock } from '../src/features/editor/textBlockCodec.ts'

function ids(kind: 'text' | 'checklist', index: number): string {
  return `${kind}-${index}`
}

test('plain insertion splits text around one writable checklist and clears the plain snapshot', async () => {
  let saved: EditorSurfaceBlockChangeSet | null = null
  let plainText: string | null = null
  const result = await insertOanixChecklistBlock({
    mode: 'plain',
    title: 'Tareas',
    text: 'antesDESPUES',
    cursorOffset: 5,
    existingBlocks: [],
    saveBlockChanges: async (changes) => { saved = changes; return true },
    savePlainSnapshot: async (snapshot) => { plainText = snapshot.text; return true },
    createId: ids,
  })

  assert.equal(result.status, 'committed')
  if (result.status !== 'committed') throw new Error('unexpected result')
  assert.deepEqual(result.plan.blocks.map((block) => block.kind), ['text-segment', 'checklist', 'text-segment'])
  assert.deepEqual(decodeChecklistBlock(result.plan.blocks[1])?.items, [{ text: '', checked: false }])
  assert.deepEqual(saved?.order, ['text-0', 'checklist-0', 'text-1'])
  assert.equal(plainText, '')
})

test('mixed insertion replaces the target text segment at the cursor', async () => {
  const blocks = [
    encodeTextBlock({ id: 'a', kind: 'text-segment', text: 'primero' }),
    encodeTextBlock({ id: 'target', kind: 'text-segment', text: 'antesDESPUES' }),
  ]
  let saved: EditorSurfaceBlockChangeSet | null = null
  const result = await insertOanixChecklistBlock({
    mode: 'mixed',
    blocks,
    targetTextBlockId: 'target',
    cursorOffset: 5,
    saveBlockChanges: async (changes) => { saved = changes; return true },
    createId: ids,
  })

  assert.equal(result.status, 'committed')
  if (result.status !== 'committed') throw new Error('unexpected result')
  assert.deepEqual(saved?.deletes, ['target'])
  assert.deepEqual(result.plan.blocks.map((block) => block.id), ['a', 'text-0', 'checklist-0', 'text-1'])
})

test('failed document commit does not claim checklist insertion succeeded', async () => {
  const result = await insertOanixChecklistBlock({
    mode: 'mixed',
    blocks: [encodeTextBlock({ id: 'target', kind: 'text-segment', text: '' })],
    targetTextBlockId: 'target',
    cursorOffset: 0,
    saveBlockChanges: async () => false,
  })
  assert.equal(result.status, 'document-save-failed')
})

test('failed plain snapshot rolls back inserted rich blocks', async () => {
  let rollback: EditorSurfaceBlockChangeSet | null = null
  let call = 0
  const result = await insertOanixChecklistBlock({
    mode: 'plain',
    title: 'Tareas',
    text: 'texto',
    cursorOffset: 2,
    existingBlocks: [],
    saveBlockChanges: async (changes) => {
      call += 1
      if (call === 2) rollback = changes
      return true
    },
    savePlainSnapshot: async () => false,
    createId: ids,
  })

  assert.equal(result.status, 'plain-transition-failed')
  if (result.status !== 'plain-transition-failed') throw new Error('unexpected result')
  assert.equal(result.blockRollbackSucceeded, true)
  assert.deepEqual(rollback?.order, [])
  assert.deepEqual(rollback?.deletes, ['text-0', 'checklist-0', 'text-1'])
})
