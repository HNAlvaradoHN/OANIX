import assert from 'node:assert/strict'
import test from 'node:test'
import { planOanixCursorInsertion } from '../src/features/editor/oanixDocumentInsertion.ts'

test('cursor insertion splits text without losing or duplicating content', () => {
  const source = 'Primera línea\nTexto después del cursor'
  const offset = source.indexOf(' después')
  const plan = planOanixCursorInsertion(source, offset)

  assert.equal(plan.cursorOffset, offset)
  assert.equal(plan.beforeText + plan.afterText, source)
  assert.equal(plan.beforeText, 'Primera línea\nTexto')
  assert.equal(plan.afterText, ' después del cursor')
})

test('cursor insertion uses textarea UTF-16 offsets exactly, including emoji', () => {
  const source = 'uno🙂dos'
  const offset = 'uno🙂'.length
  const plan = planOanixCursorInsertion(source, offset)

  assert.equal(plan.beforeText, 'uno🙂')
  assert.equal(plan.afterText, 'dos')
  assert.equal(plan.beforeText + plan.afterText, source)
})

test('cursor insertion clamps malformed offsets without throwing or dropping text', () => {
  assert.deepEqual(planOanixCursorInsertion('abc', -20), {
    cursorOffset: 0,
    beforeText: '',
    afterText: 'abc',
  })
  assert.deepEqual(planOanixCursorInsertion('abc', 99), {
    cursorOffset: 3,
    beforeText: 'abc',
    afterText: '',
  })
  assert.deepEqual(planOanixCursorInsertion('abc', Number.NaN), {
    cursorOffset: 3,
    beforeText: 'abc',
    afterText: '',
  })
})
