import assert from 'node:assert/strict'
import test from 'node:test'
import type { EditorSurfaceBlockChangeSet } from '../src/features/editor/editorSurfaceContract.ts'
import { decodeCodeBlock } from '../src/features/editor/codeBlockCodec.ts'
import { insertOanixCodeBlock } from '../src/features/editor/oanixCodeBlockLayer.ts'
import { encodeTextBlock } from '../src/features/editor/textBlockCodec.ts'

function ids(kind: 'text' | 'code', index: number): string { return `${kind}-${index}` }

test('mixed insertion splits the active text around one code block and preserves order', async () => {
  let saved: EditorSurfaceBlockChangeSet | null = null
  const result = await insertOanixCodeBlock({
    mode: 'mixed',
    blocks: [encodeTextBlock({ id: 'target', kind: 'text-segment', text: 'antesDESPUES' })],
    targetTextBlockId: 'target',
    cursorOffset: 5,
    saveBlockChanges: async (changes) => { saved = changes; return true },
    createId: ids,
  })

  assert.equal(result.status, 'committed')
  if (result.status !== 'committed') throw new Error('unexpected result')
  assert.equal(result.plan.codeBlockId, 'code-0')
  assert.deepEqual(result.plan.order, ['text-0', 'code-0', 'text-1'])
  assert.deepEqual(saved?.deletes, ['target'])
  const code = result.plan.blocks.map(decodeCodeBlock).find((item) => item !== null)
  assert.equal(code?.language, 'plaintext')
  assert.equal(code?.text, '')
})

test('plain insertion commits blocks first and then clears legacy text', async () => {
  const calls: string[] = []
  const result = await insertOanixCodeBlock({
    mode: 'plain',
    title: 'Nota',
    text: 'uno dos',
    cursorOffset: 3,
    existingBlocks: [],
    saveBlockChanges: async () => { calls.push('blocks'); return true },
    savePlainSnapshot: async (snapshot) => { calls.push(`plain:${snapshot.text}`); return true },
    createId: ids,
  })

  assert.equal(result.status, 'committed')
  assert.deepEqual(calls, ['blocks', 'plain:'])
})

test('plain transition rolls back new blocks if clearing legacy text fails', async () => {
  const changes: EditorSurfaceBlockChangeSet[] = []
  const result = await insertOanixCodeBlock({
    mode: 'plain',
    title: 'Nota',
    text: 'texto',
    cursorOffset: 2,
    existingBlocks: [],
    saveBlockChanges: async (change) => { changes.push(change); return true },
    savePlainSnapshot: async () => false,
    createId: ids,
  })

  assert.equal(result.status, 'plain-transition-failed')
  if (result.status !== 'plain-transition-failed') throw new Error('unexpected result')
  assert.equal(result.blockRollbackSucceeded, true)
  assert.equal(changes.length, 2)
  assert.deepEqual(changes[1].order, [])
  assert.deepEqual(changes[1].deletes, ['text-0', 'code-0', 'text-1'])
})

test('mixed insertion refuses a missing or non-text target without writing', async () => {
  let writes = 0
  const result = await insertOanixCodeBlock({
    mode: 'mixed',
    blocks: [],
    targetTextBlockId: 'missing',
    cursorOffset: 0,
    saveBlockChanges: async () => { writes += 1; return true },
  })
  assert.equal(result.status, 'invalid-target')
  assert.equal(writes, 0)
})
