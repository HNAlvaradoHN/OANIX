import assert from 'node:assert/strict'
import test from 'node:test'
import { createEditorBlockSession } from '../src/features/editor/editorBlockSession.ts'
import type {
  EditorSurfaceBlock,
  EditorSurfaceBlockChangeSet,
} from '../src/features/editor/editorSurfaceContract.ts'

function block(id: string, text: string): EditorSurfaceBlock {
  return { id, kind: 'text', data: { text } }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

test('block session stays completely lazy until rich block work is requested', async () => {
  let loads = 0
  let saves = 0
  const session = createEditorBlockSession({
    loadBlocks: async () => {
      loads += 1
      return [block('a', 'one')]
    },
    saveChanges: async () => {
      saves += 1
      return true
    },
  })

  assert.equal(loads, 0)
  assert.equal(saves, 0)
  assert.equal(session.hasPending(), false)
  assert.equal(await session.flush(), true)
  assert.equal(loads, 0)
  assert.equal(saves, 0)
})

test('concurrent first access shares one block load', async () => {
  const gate = deferred<EditorSurfaceBlock[]>()
  let loads = 0
  const session = createEditorBlockSession({
    loadBlocks: async () => {
      loads += 1
      return gate.promise
    },
    saveChanges: async () => true,
  })

  const first = session.load()
  const second = session.load()
  await Promise.resolve()
  assert.equal(loads, 1)

  gate.resolve([block('a', 'one')])
  assert.deepEqual(await first, [block('a', 'one')])
  assert.deepEqual(await second, [block('a', 'one')])
})

test('equivalent edits do not produce a persistence call', async () => {
  let saves = 0
  const session = createEditorBlockSession({
    loadBlocks: async () => [block('a', 'one')],
    saveChanges: async () => {
      saves += 1
      return true
    },
  })

  assert.equal(await session.upsert(block('a', 'one')), false)
  assert.equal(await session.flush(), true)
  assert.equal(saves, 0)
})

test('indexed insertion preserves the requested sequence in one checkpoint', async () => {
  const calls: EditorSurfaceBlockChangeSet[] = []
  const session = createEditorBlockSession({
    loadBlocks: async () => [block('a', 'one'), block('c', 'three')],
    saveChanges: async (changes) => {
      calls.push(changes)
      return true
    },
  })

  assert.equal(await session.insert(block('b', 'two'), 1), true)
  assert.deepEqual(await session.load(), [
    block('a', 'one'),
    block('b', 'two'),
    block('c', 'three'),
  ])
  assert.equal(await session.flush(), true)
  assert.deepEqual(calls, [{
    upserts: [block('b', 'two')],
    order: ['a', 'b', 'c'],
  }])
})

test('flush sends compact dirty changes and commits them once', async () => {
  const calls: EditorSurfaceBlockChangeSet[] = []
  const session = createEditorBlockSession({
    loadBlocks: async () => [block('a', 'one')],
    saveChanges: async (changes) => {
      calls.push(changes)
      return true
    },
  })

  await session.upsert(block('a', 'two'))
  await session.upsert(block('b', 'three'))
  assert.equal(session.hasPending(), true)
  assert.equal(await session.flush(), true)
  assert.equal(session.hasPending(), false)
  assert.deepEqual(calls, [{
    upserts: [block('a', 'two'), block('b', 'three')],
    order: ['a', 'b'],
  }])
  assert.equal(await session.flush(), true)
  assert.equal(calls.length, 1)
})

test('edits made during an in-flight checkpoint are flushed next without being lost', async () => {
  const firstGate = deferred<boolean>()
  const calls: EditorSurfaceBlockChangeSet[] = []
  const session = createEditorBlockSession({
    loadBlocks: async () => [block('a', 'one')],
    saveChanges: async (changes) => {
      calls.push(changes)
      if (calls.length === 1) return firstGate.promise
      return true
    },
  })

  await session.upsert(block('a', 'two'))
  const flushing = session.flush()
  await Promise.resolve()
  await session.upsert(block('a', 'three'))

  firstGate.resolve(true)
  assert.equal(await flushing, true)
  assert.deepEqual(calls, [
    { upserts: [block('a', 'two')] },
    { upserts: [block('a', 'three')] },
  ])
  assert.equal(session.hasPending(), false)
})

test('failed save keeps the same checkpoint retryable', async () => {
  let attempt = 0
  const calls: EditorSurfaceBlockChangeSet[] = []
  const session = createEditorBlockSession({
    loadBlocks: async () => [block('a', 'one')],
    saveChanges: async (changes) => {
      attempt += 1
      calls.push(changes)
      return attempt > 1
    },
  })

  await session.upsert(block('a', 'two'))
  assert.equal(await session.flush(), false)
  assert.equal(session.hasPending(), true)
  assert.equal(await session.flush(), true)
  assert.equal(session.hasPending(), false)
  assert.deepEqual(calls, [
    { upserts: [block('a', 'two')] },
    { upserts: [block('a', 'two')] },
  ])
})
