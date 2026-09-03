import assert from 'node:assert/strict'
import test from 'node:test'
import { insertOanixImageAtCursor } from '../src/features/editor/oanixImageInsertionCoordinator.ts'
import type { EditorSurfaceAttachment, EditorSurfaceBlockChangeSet, EditorSurfaceSnapshot } from '../src/features/editor/editorSurfaceContract.ts'

const file = new File(['image'], 'photo.png', { type: 'image/png' })
const attachment: EditorSurfaceAttachment = {
  id: 'asset-1',
  name: 'photo.png',
  mimeType: 'image/png',
  byteLength: 5,
  createdAt: '2026-09-03T00:00:00.000Z',
  remote: false,
}

function createId(kind: 'text' | 'image', index: number): string {
  return `${kind}-${index}`
}

test('image coordinator stores first and commits the mixed transition', async () => {
  const events: string[] = []
  const result = await insertOanixImageAtCursor({
    file,
    title: 'Nota',
    text: 'antes después',
    cursorOffset: 5,
    existingBlocks: [],
    storeAttachment: async () => { events.push('store'); return attachment },
    saveBlockChanges: async (changes: EditorSurfaceBlockChangeSet) => { events.push(`blocks:${changes.order?.length ?? 0}`); return true },
    savePlainSnapshot: async (snapshot: EditorSurfaceSnapshot) => { events.push(`plain:${snapshot.text}`); return true },
    removeAttachment: async () => { events.push('remove'); return true },
    createId,
  })

  assert.equal(result.status, 'committed')
  assert.deepEqual(events, ['store', 'blocks:3', 'plain:'])
})

test('image coordinator reports store failure without touching note data', async () => {
  let blockSaveCalled = false
  const result = await insertOanixImageAtCursor({
    file,
    title: 'Nota',
    text: 'abc',
    cursorOffset: 1,
    existingBlocks: [],
    storeAttachment: async () => { throw new Error('store failed') },
    saveBlockChanges: async () => { blockSaveCalled = true; return true },
    savePlainSnapshot: async () => true,
    removeAttachment: async () => true,
    createId,
  })

  assert.equal(result.status, 'store-failed')
  assert.equal(blockSaveCalled, false)
})

test('image coordinator exposes transition cleanup result instead of hiding partial failure', async () => {
  let removedId = ''
  const result = await insertOanixImageAtCursor({
    file,
    title: 'Nota',
    text: 'abc',
    cursorOffset: 1,
    existingBlocks: [],
    storeAttachment: async () => attachment,
    saveBlockChanges: async () => false,
    savePlainSnapshot: async () => true,
    removeAttachment: async (id) => { removedId = id; return true },
    createId,
  })

  assert.equal(result.status, 'transition-failed')
  if (result.status !== 'transition-failed') throw new Error('unexpected result')
  assert.equal(result.transition.status, 'block-save-failed')
  assert.equal(result.transition.attachmentCleanupSucceeded, true)
  assert.equal(removedId, attachment.id)
})
