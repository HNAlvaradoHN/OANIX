import assert from 'node:assert/strict'
import test from 'node:test'

import {
  clampImageWidthPercent,
  defaultImageWidthPercent,
  imageAlignmentFromCenterRatio,
  isMobileImageViewport,
  resizeImageWidthPercent,
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

test('keeps a small horizontal safety margin at maximum mobile size', () => {
  assert.equal(clampImageWidthPercent(340, 140, true), 96)
  assert.equal(clampImageWidthPercent(800, 140, false), 100)
})

test('keeps the wider desktop safety minimum', () => {
  assert.equal(clampImageWidthPercent(800, 5, false), 35)
  assert.equal(clampImageWidthPercent(500, 5, false), 44)
})

test('resizes proportionally from horizontal corner movement', () => {
  assert.equal(resizeImageWidthPercent({
    editorWidth: 340,
    startWidthPercent: 50,
    previewWidth: 170,
    previewHeight: 100,
    deltaX: 34,
    deltaY: 0,
    direction: 'se',
    mobile: true,
  }), 60)
})

test('resizes proportionally from vertical corner movement', () => {
  assert.equal(resizeImageWidthPercent({
    editorWidth: 340,
    startWidthPercent: 50,
    previewWidth: 170,
    previewHeight: 340,
    deltaX: 0,
    deltaY: 68,
    direction: 'se',
    mobile: true,
  }), 60)
})

test('snaps horizontal image drag to responsive alignment zones', () => {
  assert.equal(imageAlignmentFromCenterRatio(0.1), 'left')
  assert.equal(imageAlignmentFromCenterRatio(0.5), 'center')
  assert.equal(imageAlignmentFromCenterRatio(0.9), 'right')
  assert.equal(imageAlignmentFromCenterRatio(Number.NaN), 'center')
})
