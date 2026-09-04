import assert from 'node:assert/strict'
import test from 'node:test'
import type { EditorSurfaceBlockChangeSet } from '../src/features/editor/editorSurfaceContract.ts'
import { insertOanixSeparatorBlock } from '../src/features/editor/oanixSeparatorBlockLayer.ts'
import { decodeSeparatorBlock } from '../src/features/editor/separatorBlockCodec.ts'
import { encodeTextBlock } from '../src/features/editor/textBlockCodec.ts'

function ids(kind: 'text' | 'separator', index: number): string {
  return `${kind}-${index}`
}

test('plain separator insertion splits text and clears the plain snapshot', async () => {
  let saved: EditorSurfaceBlockChangeSet | null = null
  let plainText = 'not-saved'
  const result = await insertOanixSeparatorBlock({
    mode: 'plain',
    title: 'Nota',
    text: 'antesDESPUES',
    cursorOffset: 5,
    existingBlocks: [],
    saveBlockChanges: async (changes) => { saved = changes; return true },
    savePlainSnapshot: async (snapshot) => { plainText = snapshot.text; return true },
    createId: ids,
  })

  assert.equal(result.status, 'committed')
  if (result.status !== 'committed') throw new Error('unexpected result')
  assert.deepEqual(result.plan.blocks.map((block) => block.id), ['text-0', 'separator-0', 'text-1'])
  assert.equal(result.plan.blocks.map(decodeSeparatorBlock).find(Boolean)?.id, 'separator-0')
  assert.deepEqual(saved?.order, ['text-0', 'separator-0', 'text-1'])
  assert.equal(plainText, '')
})

test('mixed separator insertion replaces only the target text block at the cursor', async () => {
  let saved: EditorSurfaceBlockChangeSet | null = null
  const result = await insertOanixSeparatorBlock({
    mode: 'mixed',
    blocks: [encodeTextBlock({ id: 'target', kind: 'text-segment', text: 'antesDESPUES' })],
    targetTextBlockId: 'target',
    cursorOffset: 5,
    saveBlockChanges: async (changes) => { saved = changes; return true },
    createId: ids,
  })

  assert.equal(result.status, 'committed')
  if (result.status !== 'committed') throw new Error('unexpected result')
  assert.deepEqual(saved?.deletes, ['target'])
  assert.deepEqual(result.plan.blocks.map((block) => block.id), ['text-0', 'separator-0', 'text-1'])
})

test('failed plain snapshot rolls every inserted separator block back', async () => {
  let rollback: EditorSurfaceBlockChangeSet | null = null
  let call = 0
  const result = await insertOanixSeparatorBlock({
    mode: 'plain',
    title: 'Nota',
    text: 'texto',
    cursorOffset: 2,
    existingBlocks: [],
    saveBlockChanges: async (changes) => { call += 1; if (call === 2) rollback = changes; return true },
    savePlainSnapshot: async () => false,
    createId: ids,
  })

  assert.equal(result.status, 'plain-transition-failed')
  if (result.status !== 'plain-transition-failed') throw new Error('unexpected result')
  assert.equal(result.blockRollbackSucceeded, true)
  assert.deepEqual(rollback?.order, [])
  assert.deepEqual(rollback?.deletes, ['text-0', 'separator-0', 'text-1'])
})
