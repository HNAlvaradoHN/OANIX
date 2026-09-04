import assert from 'node:assert/strict'
import test from 'node:test'
import type { EditorSurfaceBlockChangeSet } from '../src/features/editor/editorSurfaceContract.ts'
import { decodeDailyEntryBlock } from '../src/features/editor/dailyEntryBlockCodec.ts'
import { insertOanixDailyEntryBlock } from '../src/features/editor/oanixDailyEntryBlockLayer.ts'
import { encodeTextBlock } from '../src/features/editor/textBlockCodec.ts'

function ids(kind: 'text' | 'daily-entry', index: number): string {
  return `${kind}-${index}`
}

test('plain daily entry insertion splits text at cursor and uses supplied local day', async () => {
  let saved: EditorSurfaceBlockChangeSet | null = null
  let plainText = 'not-saved'
  const result = await insertOanixDailyEntryBlock({
    mode: 'plain',
    title: 'Nota',
    text: 'antesDESPUES',
    cursorOffset: 5,
    existingBlocks: [],
    now: new Date(2026, 8, 4, 8, 30, 0),
    saveBlockChanges: async (changes) => { saved = changes; return true },
    savePlainSnapshot: async (snapshot) => { plainText = snapshot.text; return true },
    createId: ids,
  })

  assert.equal(result.status, 'committed')
  if (result.status !== 'committed') throw new Error('unexpected result')
  assert.deepEqual(result.plan.blocks.map((block) => block.id), ['text-0', 'daily-entry-0', 'text-1'])
  const entry = result.plan.blocks.map(decodeDailyEntryBlock).find(Boolean)
  assert.equal(entry?.date, '2026-09-04')
  assert.equal(entry?.title, '')
  assert.equal(entry?.text, '')
  assert.deepEqual(saved?.order, ['text-0', 'daily-entry-0', 'text-1'])
  assert.equal(plainText, '')
})

test('mixed daily entry insertion replaces only target text block at cursor', async () => {
  let saved: EditorSurfaceBlockChangeSet | null = null
  const result = await insertOanixDailyEntryBlock({
    mode: 'mixed',
    blocks: [encodeTextBlock({ id: 'target', kind: 'text-segment', text: 'antesDESPUES' })],
    targetTextBlockId: 'target',
    cursorOffset: 5,
    now: new Date(2026, 8, 4, 8, 30, 0),
    saveBlockChanges: async (changes) => { saved = changes; return true },
    createId: ids,
  })

  assert.equal(result.status, 'committed')
  if (result.status !== 'committed') throw new Error('unexpected result')
  assert.deepEqual(saved?.deletes, ['target'])
  assert.deepEqual(result.plan.blocks.map((block) => block.id), ['text-0', 'daily-entry-0', 'text-1'])
})

test('failed plain snapshot rolls all entry transition blocks back', async () => {
  let rollback: EditorSurfaceBlockChangeSet | null = null
  let call = 0
  const result = await insertOanixDailyEntryBlock({
    mode: 'plain',
    title: 'Nota',
    text: 'texto',
    cursorOffset: 2,
    existingBlocks: [],
    now: new Date(2026, 8, 4, 8, 30, 0),
    saveBlockChanges: async (changes) => { call += 1; if (call === 2) rollback = changes; return true },
    savePlainSnapshot: async () => false,
    createId: ids,
  })

  assert.equal(result.status, 'plain-transition-failed')
  if (result.status !== 'plain-transition-failed') throw new Error('unexpected result')
  assert.equal(result.blockRollbackSucceeded, true)
  assert.deepEqual(rollback?.order, [])
  assert.deepEqual(rollback?.deletes, ['text-0', 'daily-entry-0', 'text-1'])
})
