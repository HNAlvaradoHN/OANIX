import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyOanixTextPaste } from '../src/features/editor/oanixLargePastePolicy.ts'

test('normal clipboard text stays inline with exact lightweight metrics', () => {
  const result = classifyOanixTextPaste('hola\nmundo 😀', {
    maxUtf16Length: 100,
    maxUtf8Bytes: 100,
    maxLines: 10,
  })

  assert.deepEqual(result, {
    mode: 'inline',
    utf16Length: 13,
    utf8Bytes: 15,
    lines: 2,
  })
})

test('very large clipboard strings exit on UTF-16 length before a full scan is required', () => {
  const result = classifyOanixTextPaste('x'.repeat(101), {
    maxUtf16Length: 100,
    maxUtf8Bytes: 1_000,
    maxLines: 1_000,
  })

  assert.deepEqual(result, {
    mode: 'large-text-element',
    reason: 'utf16-size',
    utf16Length: 101,
  })
})

test('many short lines route to the long-text element even when byte size is small', () => {
  const result = classifyOanixTextPaste('a\nb\nc\nd', {
    maxUtf16Length: 100,
    maxUtf8Bytes: 100,
    maxLines: 3,
  })

  assert.equal(result.mode, 'large-text-element')
  if (result.mode !== 'large-text-element') throw new Error('unexpected result')
  assert.equal(result.reason, 'line-count')
  assert.equal(result.lines, 4)
})

test('multibyte text routes by estimated UTF-8 bytes without TextEncoder allocation', () => {
  const result = classifyOanixTextPaste('á😀á', {
    maxUtf16Length: 100,
    maxUtf8Bytes: 6,
    maxLines: 10,
  })

  assert.equal(result.mode, 'large-text-element')
  if (result.mode !== 'large-text-element') throw new Error('unexpected result')
  assert.equal(result.reason, 'utf8-size')
  assert.equal(result.utf8Bytes, 8)
})

test('an unpaired surrogate is measured like browser UTF-8 replacement encoding', () => {
  const result = classifyOanixTextPaste('\ud800', {
    maxUtf16Length: 10,
    maxUtf8Bytes: 10,
    maxLines: 10,
  })

  assert.deepEqual(result, {
    mode: 'inline',
    utf16Length: 1,
    utf8Bytes: 3,
    lines: 1,
  })
})
