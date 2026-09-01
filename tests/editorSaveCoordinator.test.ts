import assert from 'node:assert/strict'
import test from 'node:test'
import { createEditorSaveCoordinator } from '../src/features/rebuild/editorSaveCoordinator.ts'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

test('editor persistence operations execute strictly in submission order', async () => {
  const coordinator = createEditorSaveCoordinator()
  const firstGate = deferred<void>()
  const events: string[] = []

  const first = coordinator.run(async () => {
    events.push('first:start')
    await firstGate.promise
    events.push('first:end')
    return 1
  })
  const second = coordinator.run(async () => {
    events.push('second:start')
    events.push('second:end')
    return 2
  })

  await Promise.resolve()
  assert.deepEqual(events, ['first:start'])

  firstGate.resolve()
  assert.equal(await first, 1)
  assert.equal(await second, 2)
  assert.deepEqual(events, [
    'first:start',
    'first:end',
    'second:start',
    'second:end',
  ])
})

test('a rejected save does not poison later editor persistence', async () => {
  const coordinator = createEditorSaveCoordinator()
  const expected = new Error('save failed')

  const failed = coordinator.run(async () => {
    throw expected
  })
  const recovered = coordinator.run(async () => 'next-save-ran')

  await assert.rejects(failed, expected)
  assert.equal(await recovered, 'next-save-ran')
})

test('idle resolves only after all currently queued persistence finishes', async () => {
  const coordinator = createEditorSaveCoordinator()
  const gate = deferred<void>()
  let idleResolved = false

  void coordinator.run(async () => {
    await gate.promise
  })
  const idle = coordinator.idle().then(() => {
    idleResolved = true
  })

  await Promise.resolve()
  assert.equal(idleResolved, false)

  gate.resolve()
  await idle
  assert.equal(idleResolved, true)
})

test('coordinator has no timers, polling, storage or network authority', () => {
  const source = String(createEditorSaveCoordinator)
  assert.doesNotMatch(source, /setTimeout|setInterval|indexedDB|localStorage|sessionStorage|fetch\(|XMLHttpRequest/)
})
