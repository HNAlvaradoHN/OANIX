import assert from 'node:assert/strict'
import test from 'node:test'

import { keyboardInsetFromViewport } from '../src/shared/viewportMetrics.ts'

test('keyboard inset follows the visible viewport without assuming a device class', () => {
  assert.equal(keyboardInsetFromViewport({ layoutHeight: 800, visualHeight: 500, visualOffsetTop: 0 }), 300)
  assert.equal(keyboardInsetFromViewport({ layoutHeight: 800, visualHeight: 500, visualOffsetTop: 80 }), 220)
  assert.equal(keyboardInsetFromViewport({ layoutHeight: 500, visualHeight: 500, visualOffsetTop: 0 }), 0)
})

test('keyboard inset never becomes negative or NaN', () => {
  assert.equal(keyboardInsetFromViewport({ layoutHeight: 500, visualHeight: 540, visualOffsetTop: 0 }), 0)
  assert.equal(keyboardInsetFromViewport({ layoutHeight: Number.NaN, visualHeight: 500, visualOffsetTop: 0 }), 0)
})
