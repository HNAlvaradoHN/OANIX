import assert from 'node:assert/strict'
import test from 'node:test'
import type { EditorSurfaceBlockChangeSet, EditorSurfaceSnapshot } from '../src/features/editor/editorSurfaceContract.ts'
import { commitOanixMixedDocumentImageTransition } from '../src/features/editor/oanixMixedDocumentTransition.ts'

function deterministicId(kind: 'text' | 'image', index: number): string {
  return `${kind}-${index}`
}

test('mixed transition commits blocks before clearing the plain body', async () => {
  const events: string[] = []
  const changes: EditorSurfaceBlockChangeSet[] = []
  const snapshots: EditorSurfaceSnapshot[] = []

  const result = await commitOanixMixedDocumentImageTransition({
    title: 'Título',
    text: 'antes después',
    cursorOffset: 5,
    attachmentId: 'asset-1',
    existingBlocks: [],
    createId: deterministicId,
    saveBlockChanges: async (change) => {
      events.push('blocks')
      changes.push(change)
      return true
    },
    savePlainSnapshot: async (snapshot) => {
      events.push('plain')
      snapshots.push(snapshot)
      return true
    },
    removeAttachment: async () => {
      events.push('remove-attachment')
      return true
    },
  })

  assert.equal(result.status, 'committed')
  assert.deepEqual(events, ['blocks', 'plain'])
  assert.equal(changes.length, 1)
  assert.deepEqual(snapshots, [{ title: 'Título', text: '' }])
})

test('failed block save keeps original plain text and removes the newly stored attachment', async () => {
  let plainSaveCalls = 0
  let removed = ''

  const result = await commitOanixMixedDocumentImageTransition({
    title: 'Título',
    text: 'contenido intacto',
    cursorOffset: 4,
    attachmentId: 'asset-2',
    existingBlocks: [],
    createId: deterministicId,
    saveBlockChanges: async () => false,
    savePlainSnapshot: async () => {
      plainSaveCalls += 1
      return true
    },
    removeAttachment: async (attachmentId) => {
      removed = attachmentId
      return true
    },
  })

  assert.deepEqual(result, {
    status: 'block-save-failed',
    attachmentCleanupSucceeded: true,
  })
  assert.equal(plainSaveCalls, 0)
  assert.equal(removed, 'asset-2')
})

test('failed plain save compensates staged blocks before removing the attachment', async () => {
  const events: string[] = []
  const blockChanges: EditorSurfaceBlockChangeSet[] = []

  const result = await commitOanixMixedDocumentImageTransition({
    title: 'Título',
    text: 'abcdef',
    cursorOffset: 3,
    attachmentId: 'asset-3',
    existingBlocks: [],
    createId: deterministicId,
    saveBlockChanges: async (changes) => {
      blockChanges.push(changes)
      events.push(blockChanges.length === 1 ? 'blocks-stage' : 'blocks-rollback')
      return true
    },
    savePlainSnapshot: async () => {
      events.push('plain-failed')
      return false
    },
    removeAttachment: async () => {
      events.push('remove-attachment')
      return true
    },
  })

  assert.deepEqual(result, {
    status: 'plain-save-failed',
    blockRollbackSucceeded: true,
    attachmentCleanupSucceeded: true,
  })
  assert.deepEqual(events, ['blocks-stage', 'plain-failed', 'blocks-rollback', 'remove-attachment'])
  assert.deepEqual(blockChanges[1], {
    deletes: blockChanges[0].order,
    order: [],
  })
})

test('failed block rollback keeps the attachment because references may still exist', async () => {
  let blockSaveCalls = 0
  let removeCalls = 0

  const result = await commitOanixMixedDocumentImageTransition({
    title: 'Título',
    text: 'abcdef',
    cursorOffset: 3,
    attachmentId: 'asset-4',
    existingBlocks: [],
    createId: deterministicId,
    saveBlockChanges: async () => {
      blockSaveCalls += 1
      return blockSaveCalls === 1
    },
    savePlainSnapshot: async () => false,
    removeAttachment: async () => {
      removeCalls += 1
      return true
    },
  })

  assert.deepEqual(result, {
    status: 'plain-save-failed',
    blockRollbackSucceeded: false,
    attachmentCleanupSucceeded: null,
  })
  assert.equal(removeCalls, 0)
})

test('pre-existing rich blocks prevent transition and clean the unreferenced new attachment', async () => {
  let blockSaveCalls = 0
  let plainSaveCalls = 0
  const existingBlock = { id: 'existing', kind: 'code', data: {} }

  const result = await commitOanixMixedDocumentImageTransition({
    title: 'Título',
    text: 'abcdef',
    cursorOffset: 3,
    attachmentId: 'asset-5',
    existingBlocks: [existingBlock],
    createId: deterministicId,
    saveBlockChanges: async () => {
      blockSaveCalls += 1
      return true
    },
    savePlainSnapshot: async () => {
      plainSaveCalls += 1
      return true
    },
    removeAttachment: async () => true,
  })

  assert.deepEqual(result, {
    status: 'blocked-existing-blocks',
    attachmentCleanupSucceeded: true,
  })
  assert.equal(blockSaveCalls, 0)
  assert.equal(plainSaveCalls, 0)
})
