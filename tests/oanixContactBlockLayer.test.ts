import assert from 'node:assert/strict'
import test from 'node:test'
import type { EditorSurfaceBlockChangeSet } from '../src/features/editor/editorSurfaceContract.ts'
import { decodeContactBlock } from '../src/features/editor/contactBlockCodec.ts'
import { insertOanixContactBlock } from '../src/features/editor/oanixContactBlockLayer.ts'
import { encodeTextBlock } from '../src/features/editor/textBlockCodec.ts'

function ids(kind: 'text' | 'contact', index: number): string { return `${kind}-${index}` }

test('plain contact insertion splits text and creates an editable private card', async () => {
  let saved: EditorSurfaceBlockChangeSet | null = null
  let plainText = 'not-saved'
  const result = await insertOanixContactBlock({
    mode: 'plain', title: 'Personas', text: 'antesDESPUES', cursorOffset: 5, existingBlocks: [],
    saveBlockChanges: async (changes) => { saved = changes; return true },
    savePlainSnapshot: async (snapshot) => { plainText = snapshot.text; return true },
    createId: ids,
  })
  assert.equal(result.status, 'committed')
  if (result.status !== 'committed') throw new Error('unexpected result')
  const contact = result.plan.blocks.map(decodeContactBlock).find(Boolean)
  assert.equal(contact?.name, 'Nuevo contacto')
  assert.deepEqual(saved?.order, ['text-0', 'contact-0', 'text-1'])
  assert.equal(plainText, '')
})

test('mixed contact insertion replaces target text at cursor', async () => {
  let saved: EditorSurfaceBlockChangeSet | null = null
  const result = await insertOanixContactBlock({
    mode: 'mixed',
    blocks: [encodeTextBlock({ id: 'target', kind: 'text-segment', text: 'antesDESPUES' })],
    targetTextBlockId: 'target', cursorOffset: 5,
    saveBlockChanges: async (changes) => { saved = changes; return true },
    createId: ids,
  })
  assert.equal(result.status, 'committed')
  if (result.status !== 'committed') throw new Error('unexpected result')
  assert.deepEqual(saved?.deletes, ['target'])
  assert.deepEqual(result.plan.blocks.map((block) => block.id), ['text-0', 'contact-0', 'text-1'])
})

test('failed plain snapshot rolls contact blocks back', async () => {
  let rollback: EditorSurfaceBlockChangeSet | null = null
  let call = 0
  const result = await insertOanixContactBlock({
    mode: 'plain', title: 'Personas', text: 'texto', cursorOffset: 2, existingBlocks: [],
    saveBlockChanges: async (changes) => { call += 1; if (call === 2) rollback = changes; return true },
    savePlainSnapshot: async () => false,
    createId: ids,
  })
  assert.equal(result.status, 'plain-transition-failed')
  if (result.status !== 'plain-transition-failed') throw new Error('unexpected result')
  assert.equal(result.blockRollbackSucceeded, true)
  assert.deepEqual(rollback?.order, [])
  assert.deepEqual(rollback?.deletes, ['text-0', 'contact-0', 'text-1'])
})
