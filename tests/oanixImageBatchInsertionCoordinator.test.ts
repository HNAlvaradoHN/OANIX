import assert from 'node:assert/strict'
import test from 'node:test'
import type { EditorSurfaceAttachment, EditorSurfaceBlockChangeSet } from '../src/features/editor/editorSurfaceContract.ts'
import {
  OANIX_IMAGE_BATCH_CONCURRENCY,
  OANIX_IMAGE_BATCH_LIMIT,
  insertOanixImageBatch,
} from '../src/features/editor/oanixImageBatchInsertionCoordinator.ts'
import { encodeTextBlock } from '../src/features/editor/textBlockCodec.ts'

function attachment(index: number): EditorSurfaceAttachment {
  return {
    id: `asset-${index}`,
    name: `image-${index}.png`,
    mimeType: 'image/png',
    byteLength: index + 1,
    createdAt: '2026-09-03T12:00:00.000Z',
    remote: false,
  }
}

function files(count: number): File[] {
  return Array.from({ length: count }, (_, index) => new File([String(index)], `image-${index}.png`, { type: 'image/png' }))
}

function deterministicId(kind: 'text' | 'image', index: number): string {
  return `${kind}-${index}`
}

test('image batch policy is five files with controlled concurrency', () => {
  assert.equal(OANIX_IMAGE_BATCH_LIMIT, 5)
  assert.equal(OANIX_IMAGE_BATCH_CONCURRENCY, 2)
})

test('plain batch stores in controlled parallelism and commits document blocks once', async () => {
  let activeStores = 0
  let maxActiveStores = 0
  let blockSaves = 0
  let savedChanges: EditorSurfaceBlockChangeSet | null = null
  const progress: string[] = []

  const result = await insertOanixImageBatch({
    mode: 'plain',
    files: files(5),
    title: 'Nota',
    text: 'antes después',
    cursorOffset: 6,
    existingBlocks: [],
    storeAttachment: async (file) => {
      activeStores += 1
      maxActiveStores = Math.max(maxActiveStores, activeStores)
      await new Promise((resolve) => setTimeout(resolve, 2))
      const index = Number(file.name.match(/\d+/)?.[0] ?? 0)
      activeStores -= 1
      return attachment(index)
    },
    saveBlockChanges: async (changes) => {
      blockSaves += 1
      savedChanges = changes
      return true
    },
    savePlainSnapshot: async (snapshot) => snapshot.title === 'Nota' && snapshot.text === '',
    removeAttachment: async () => true,
    onProgress: (value) => progress.push(`${value.stage}:${value.completed}/${value.total}`),
    createId: deterministicId,
  })

  assert.equal(result.status, 'committed')
  if (result.status !== 'committed') throw new Error('unexpected result')
  assert.equal(maxActiveStores, 2)
  assert.equal(blockSaves, 1)
  assert.deepEqual(result.attachments.map((item) => item.id), ['asset-0', 'asset-1', 'asset-2', 'asset-3', 'asset-4'])
  assert.equal(result.plan.imageBlockIds.length, 5)
  assert.equal(savedChanges?.order?.filter((id) => id.startsWith('image-')).length, 5)
  assert.equal(progress[0], 'storing:0/5')
  assert.equal(progress.at(-1), 'committing:5/5')
})

test('mixed batch replaces one persisted text block with all images in one change set', async () => {
  const original = [
    encodeTextBlock({ id: 'before', kind: 'text-segment', text: 'previo' }),
    encodeTextBlock({ id: 'target', kind: 'text-segment', text: 'hola mundo' }),
    encodeTextBlock({ id: 'after', kind: 'text-segment', text: 'siguiente' }),
  ]
  let savedChanges: EditorSurfaceBlockChangeSet | null = null

  const result = await insertOanixImageBatch({
    mode: 'mixed',
    files: files(3),
    blocks: original,
    targetTextBlockId: 'target',
    cursorOffset: 5,
    storeAttachment: async (file) => attachment(Number(file.name.match(/\d+/)?.[0] ?? 0)),
    saveBlockChanges: async (changes) => { savedChanges = changes; return true },
    removeAttachment: async () => true,
    createId: deterministicId,
  })

  assert.equal(result.status, 'committed')
  if (result.status !== 'committed') throw new Error('unexpected result')
  assert.deepEqual(savedChanges?.deletes, ['target'])
  assert.equal(savedChanges?.order?.filter((id) => id.startsWith('image-')).length, 3)
  assert.equal(savedChanges?.upserts?.some((block) => block.id === 'before'), false)
  assert.equal(savedChanges?.upserts?.some((block) => block.id === 'after'), false)
  assert.equal(result.plan.blocks[0], original[0])
  assert.equal(result.plan.blocks.at(-1), original[2])
})

test('batch rejects more than five files before storing anything', async () => {
  let stores = 0
  const result = await insertOanixImageBatch({
    mode: 'plain',
    files: files(6),
    title: '',
    text: '',
    cursorOffset: 0,
    existingBlocks: [],
    storeAttachment: async () => { stores += 1; return attachment(stores) },
    saveBlockChanges: async () => true,
    savePlainSnapshot: async () => true,
    removeAttachment: async () => true,
  })

  assert.equal(result.status, 'invalid-batch')
  assert.equal(stores, 0)
})

test('failed store cleans successful encrypted assets and never commits blocks', async () => {
  const removed: string[] = []
  let blockSaves = 0
  const result = await insertOanixImageBatch({
    mode: 'plain',
    files: files(3),
    title: '',
    text: '',
    cursorOffset: 0,
    existingBlocks: [],
    storeAttachment: async (file) => {
      const index = Number(file.name.match(/\d+/)?.[0] ?? 0)
      if (index === 1) throw new Error('store failed')
      return attachment(index)
    },
    saveBlockChanges: async () => { blockSaves += 1; return true },
    savePlainSnapshot: async () => true,
    removeAttachment: async (id) => { removed.push(id); return true },
  })

  assert.equal(result.status, 'store-failed')
  assert.equal(blockSaves, 0)
  assert.deepEqual(removed.sort(), ['asset-0', 'asset-2'])
})
