import assert from 'node:assert/strict'
import test from 'node:test'
import type { EditorSurfaceAttachment, EditorSurfaceBlockChangeSet } from '../src/features/editor/editorSurfaceContract.ts'
import {
  appendOanixFileGroupFiles,
  insertOanixFileGroup,
  OANIX_FILE_GROUP_STORE_CONCURRENCY,
} from '../src/features/editor/oanixFileGroupLayer.ts'
import {
  MAX_OANIX_FILE_GROUP_ITEMS,
  decodeOanixFileGroupElement,
  encodeOanixFileGroupElement,
} from '../src/features/editor/oanixFileGroupElementCodec.ts'
import { encodeTextBlock } from '../src/features/editor/textBlockCodec.ts'

function file(name: string): File {
  return { name, type: 'application/octet-stream', size: 10 } as File
}

function attachment(index: number): EditorSurfaceAttachment {
  return {
    id: `asset-${index}`,
    name: `file-${index}.bin`,
    mimeType: 'application/octet-stream',
    byteLength: 10,
    createdAt: '2026-09-03T18:00:00.000Z',
    remote: false,
  }
}

function ids(kind: 'text' | 'file-group', index: number): string {
  return `${kind}-${index}`
}

test('one sidebar insertion creates one group containing the whole file selection', async () => {
  let saved: EditorSurfaceBlockChangeSet | null = null
  const result = await insertOanixFileGroup({
    mode: 'mixed',
    files: [file('file-0.bin'), file('file-1.bin'), file('file-2.bin')],
    blocks: [encodeTextBlock({ id: 'target', kind: 'text-segment', text: 'antesDESPUES' })],
    targetTextBlockId: 'target',
    cursorOffset: 5,
    storeAttachment: async (selected) => attachment(Number(selected.name.match(/\d+/)?.[0] ?? 0)),
    saveBlockChanges: async (changes) => { saved = changes; return true },
    removeAttachment: async () => true,
    createId: ids,
  })

  assert.equal(result.status, 'committed')
  if (result.status !== 'committed') throw new Error('unexpected result')
  const group = result.plan.blocks.map(decodeOanixFileGroupElement).find((item) => item !== null)
  assert.deepEqual(group?.attachmentIds, ['asset-0', 'asset-1', 'asset-2'])
  assert.equal(result.plan.groupBlockId, 'file-group-0')
  assert.deepEqual(saved?.deletes, ['target'])
})

test('adding files updates the same group instead of creating another card', async () => {
  const original = encodeOanixFileGroupElement({
    id: 'group-1',
    kind: 'oanix-file-group-element-v1',
    attachmentIds: ['asset-existing'],
  })
  let saved: EditorSurfaceBlockChangeSet | null = null
  const result = await appendOanixFileGroupFiles({
    groupBlock: original,
    files: [file('file-1.bin'), file('file-2.bin')],
    storeAttachment: async (selected) => attachment(Number(selected.name.match(/\d+/)?.[0] ?? 0)),
    saveBlockChanges: async (changes) => { saved = changes; return true },
    removeAttachment: async () => true,
  })

  assert.equal(result.status, 'committed')
  if (result.status !== 'committed') throw new Error('unexpected result')
  assert.equal(result.block.id, 'group-1')
  assert.deepEqual(decodeOanixFileGroupElement(result.block)?.attachmentIds, ['asset-existing', 'asset-1', 'asset-2'])
  assert.equal(saved?.upserts?.length, 1)
})

test('failed group commit cleans every newly encrypted file', async () => {
  const removed: string[] = []
  const result = await insertOanixFileGroup({
    mode: 'mixed',
    files: [file('file-0.bin'), file('file-1.bin')],
    blocks: [encodeTextBlock({ id: 'target', kind: 'text-segment', text: '' })],
    targetTextBlockId: 'target',
    cursorOffset: 0,
    storeAttachment: async (selected) => attachment(Number(selected.name.match(/\d+/)?.[0] ?? 0)),
    saveBlockChanges: async () => false,
    removeAttachment: async (id) => { removed.push(id); return true },
  })

  assert.equal(result.status, 'document-save-failed')
  if (result.status !== 'document-save-failed') throw new Error('unexpected result')
  assert.equal(result.attachmentCleanupSucceeded, true)
  assert.deepEqual(removed.sort(), ['asset-0', 'asset-1'])
})

test('file groups are bounded and encrypted stores keep concurrency at two', async () => {
  assert.equal(MAX_OANIX_FILE_GROUP_ITEMS, 50)
  assert.equal(OANIX_FILE_GROUP_STORE_CONCURRENCY, 2)
  let active = 0
  let maxActive = 0
  const result = await insertOanixFileGroup({
    mode: 'mixed',
    files: Array.from({ length: 5 }, (_, index) => file(`file-${index}.bin`)),
    blocks: [encodeTextBlock({ id: 'target', kind: 'text-segment', text: '' })],
    targetTextBlockId: 'target',
    cursorOffset: 0,
    storeAttachment: async (selected) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
      return attachment(Number(selected.name.match(/\d+/)?.[0] ?? 0))
    },
    saveBlockChanges: async () => true,
    removeAttachment: async () => true,
  })
  assert.equal(result.status, 'committed')
  assert.equal(maxActive, 2)
})
