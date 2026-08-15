import assert from 'node:assert/strict'
import test from 'node:test'

import {
  clampImageWidthPercent,
  defaultImageWidthPercent,
  isMobileImageViewport,
} from '../src/features/images/imageLayout.ts'

test('detects mobile image viewport at the editor breakpoint', () => {
  assert.equal(isMobileImageViewport(760), true)
  assert.equal(isMobileImageViewport(761), false)
})

test('uses a smaller default image width on mobile', () => {
  assert.equal(defaultImageWidthPercent(true), 88)
  assert.equal(defaultImageWidthPercent(false), 100)
})

test('allows substantially smaller images on a typical mobile editor', () => {
  assert.equal(clampImageWidthPercent(340, 5, true), 26)
  assert.equal(clampImageWidthPercent(340, 50, true), 50)
})

test('keeps the wider desktop safety minimum', () => {
  assert.equal(clampImageWidthPercent(800, 5, false), 35)
  assert.equal(clampImageWidthPercent(500, 5, false), 44)
})

test('never allows widths above one hundred percent', () => {
  assert.equal(clampImageWidthPercent(340, 140, true), 100)
})
