import assert from 'node:assert/strict'
import test from 'node:test'
import type { EditorSurfaceAttachment, EditorSurfaceBlockChangeSet } from '../src/features/editor/editorSurfaceContract.ts'
import { insertOanixImages, OANIX_IMAGE_SELECTION_LIMIT, OANIX_IMAGE_STORE_CONCURRENCY } from '../src/features/editor/oanixImageLayer.ts'
import { decodeOanixImageElement } from '../src/features/editor/oanixImageElementCodec.ts'
import { decodeTextBlock, encodeTextBlock } from '../src/features/editor/textBlockCodec.ts'

function file(name: string): File {
  return { name, type: 'image/png', size: 10 } as File
}

function attachment(index: number): EditorSurfaceAttachment {
  return {
    id: `asset-${index}`,
    name: `image-${index}.png`,
    mimeType: 'image/png',
    byteLength: 10,
    createdAt: '2026-09-03T18:00:00.000Z',
    remote: false,
  }
}

function ids(kind: 'text' | 'image', index: number): string {
  return `${kind}-${index}`
}

test('clean image layer uses one rule for one through five selected images', async () => {
  assert.equal(OANIX_IMAGE_SELECTION_LIMIT, 5)
  assert.equal(OANIX_IMAGE_STORE_CONCURRENCY, 2)

  for (const count of [1, 2, 5]) {
    let commitCount = 0
    const result = await insertOanixImages({
      mode: 'mixed',
      files: Array.from({ length: count }, (_, index) => file(`image-${index}.png`)),
      blocks: [encodeTextBlock({ id: 'target', kind: 'text-segment', text: 'hola mundo' })],
      targetTextBlockId: 'target',
      cursorOffset: 5,
      storeAttachment: async (selected) => attachment(Number(selected.name.match(/\d+/)?.[0] ?? 0)),
      saveBlockChanges: async () => { commitCount += 1; return true },
      removeAttachment: async () => true,
      createId: ids,
    })

    assert.equal(result.status, 'committed')
    if (result.status !== 'committed') throw new Error('unexpected result')
    assert.equal(result.attachments.length, count)
    assert.equal(result.plan.imageBlockIds.length, count)
    assert.equal(commitCount, 1)
  }
})

test('clean image layer rejects selections above five before touching encrypted attachment storage', async () => {
  let stores = 0
  const result = await insertOanixImages({
    mode: 'mixed',
    files: Array.from({ length: 6 }, (_, index) => file(`image-${index}.png`)),
    blocks: [encodeTextBlock({ id: 'target', kind: 'text-segment', text: '' })],
    targetTextBlockId: 'target',
    cursorOffset: 0,
    storeAttachment: async () => { stores += 1; return attachment(stores) },
    saveBlockChanges: async () => true,
    removeAttachment: async () => true,
  })

  assert.deepEqual(result, { status: 'invalid-selection' })
  assert.equal(stores, 0)
})

test('clean image layer preserves selection order and writable text between images', async () => {
  let saved: EditorSurfaceBlockChangeSet | null = null
  const result = await insertOanixImages({
    mode: 'mixed',
    files: [file('image-0.png'), file('image-1.png'), file('image-2.png')],
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
  assert.deepEqual(result.attachments.map((item) => item.id), ['asset-0', 'asset-1', 'asset-2'])
  assert.equal(saved?.deletes?.[0], 'target')

  const imageAttachments = result.plan.blocks
    .map(decodeOanixImageElement)
    .filter((item) => item !== null)
    .map((item) => item.attachmentId)
  assert.deepEqual(imageAttachments, ['asset-0', 'asset-1', 'asset-2'])

  const firstImageIndex = result.plan.blocks.findIndex((block) => decodeOanixImageElement(block)?.attachmentId === 'asset-0')
  const secondImageIndex = result.plan.blocks.findIndex((block) => decodeOanixImageElement(block)?.attachmentId === 'asset-1')
  const thirdImageIndex = result.plan.blocks.findIndex((block) => decodeOanixImageElement(block)?.attachmentId === 'asset-2')
  assert.equal(decodeTextBlock(result.plan.blocks[firstImageIndex - 1])?.text, 'antes')
  assert.equal(decodeTextBlock(result.plan.blocks[firstImageIndex + 1])?.text, '')
  assert.equal(decodeTextBlock(result.plan.blocks[secondImageIndex + 1])?.text, '')
  assert.equal(decodeTextBlock(result.plan.blocks[thirdImageIndex + 1])?.text, 'DESPUES')
})

test('clean image layer never stores more than two selected images concurrently', async () => {
  let active = 0
  let maxActive = 0
  const result = await insertOanixImages({
    mode: 'mixed',
    files: Array.from({ length: 5 }, (_, index) => file(`image-${index}.png`)),
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

test('clean image layer removes every stored asset if the single document commit fails', async () => {
  const removed: string[] = []
  const result = await insertOanixImages({
    mode: 'mixed',
    files: [file('image-0.png'), file('image-1.png')],
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
