import assert from 'node:assert/strict'
import test from 'node:test'
import { createEditorBlockChangeBuffer } from '../src/features/editor/editorBlockChangeBuffer'
import type { EditorSurfaceBlock } from '../src/features/editor/editorSurfaceContract'

function block(id: string, text: string): EditorSurfaceBlock {
  return {
    id,
    kind: 'text',
    data: { text },
  }
}

test('equivalent block edits are ignored without creating pending work', () => {
  const buffer = createEditorBlockChangeBuffer([
    {
      id: 'a',
      kind: 'card',
      data: { nested: { count: 1, labels: ['x', 'y'] }, enabled: true },
    },
  ])

  assert.equal(buffer.upsert({
    id: 'a',
    kind: 'card',
    data: { enabled: true, nested: { labels: ['x', 'y'], count: 1 } },
  }), false)
  assert.equal(buffer.hasPending(), false)
  assert.equal(buffer.prepare(), null)
})

test('editing and reverting before a save collapses to a no-op', () => {
  const buffer = createEditorBlockChangeBuffer([block('a', 'original')])

  assert.equal(buffer.upsert(block('a', 'changed')), true)
  assert.equal(buffer.upsert(block('a', 'original')), true)
  assert.equal(buffer.hasPending(), true)
  assert.equal(buffer.prepare(), null)
  assert.equal(buffer.hasPending(), false)
})

test('adds deletes and order changes are emitted as one compact change set', () => {
  const buffer = createEditorBlockChangeBuffer([
    block('a', 'one'),
    block('b', 'two'),
  ])

  buffer.upsert(block('c', 'three'))
  buffer.remove('a')
  buffer.reorder(['c', 'b'])

  const prepared = buffer.prepare()
  assert.ok(prepared)
  assert.deepEqual(prepared.changes, {
    upserts: [block('c', 'three')],
    deletes: ['a'],
    order: ['c', 'b'],
  })

  buffer.commit(prepared)
  assert.equal(buffer.hasPending(), false)
  assert.equal(buffer.prepare(), null)
  assert.deepEqual(buffer.current(), [block('c', 'three'), block('b', 'two')])
})

test('an in-flight checkpoint stays stable while newer typing remains dirty', () => {
  const buffer = createEditorBlockChangeBuffer([block('a', 'one')])

  buffer.upsert(block('a', 'two'))
  const first = buffer.prepare()
  assert.ok(first)
  assert.deepEqual(first.changes.upserts, [block('a', 'two')])

  buffer.upsert(block('a', 'three'))
  assert.equal(buffer.prepare(), first, 'do not create a second checkpoint while one save is unresolved')

  buffer.commit(first)
  assert.equal(buffer.hasPending(), true)

  const second = buffer.prepare()
  assert.ok(second)
  assert.notEqual(second, first)
  assert.deepEqual(second.changes, { upserts: [block('a', 'three')] })

  buffer.commit(second)
  assert.equal(buffer.hasPending(), false)
})

test('a failed save can retry the same checkpoint without losing later edits', () => {
  const buffer = createEditorBlockChangeBuffer([block('a', 'one')])

  buffer.upsert(block('a', 'two'))
  const prepared = buffer.prepare()
  assert.ok(prepared)

  buffer.upsert(block('a', 'three'))
  assert.equal(buffer.prepare(), prepared)
  assert.equal(buffer.hasPending(), true)

  buffer.commit(prepared)
  const next = buffer.prepare()
  assert.ok(next)
  assert.deepEqual(next.changes.upserts, [block('a', 'three')])
})

test('order changes validate exact current block membership and skip repeated order', () => {
  const buffer = createEditorBlockChangeBuffer([block('a', 'one'), block('b', 'two')])

  assert.equal(buffer.reorder(['a', 'b']), false)
  assert.throws(() => buffer.reorder(['a']), /every current block/)
  assert.throws(() => buffer.reorder(['a', 'a']), /every current block/)
  assert.throws(() => buffer.reorder(['a', 'missing']), /every current block/)
  assert.equal(buffer.hasPending(), false)
})

test('only the currently active checkpoint can be committed', () => {
  const buffer = createEditorBlockChangeBuffer([block('a', 'one')])
  buffer.upsert(block('a', 'two'))
  const prepared = buffer.prepare()
  assert.ok(prepared)

  assert.throws(
    () => buffer.commit({ ...prepared, changes: prepared.changes }),
    /active block change checkpoint/,
  )

  buffer.commit(prepared)
  assert.equal(buffer.hasPending(), false)
})
