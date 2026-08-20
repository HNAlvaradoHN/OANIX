import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/editor/NotebookFreeRowsRuntime.tsx', 'utf8')

test('virtual row runtime integrates image blocks into the same row map', () => {
  assert.match(runtime, /oanix\.notebook\.rows\.v9/)
  assert.match(runtime, /directCanvasBlocks/)
  assert.match(runtime, /data-image-block/)
  assert.match(runtime, /syncImageReservations/)
  assert.match(runtime, /imageStates/)
})

test('every notebook image is an atomic row barrier with no side-flow mode', () => {
  assert.match(runtime, /function imageOccupiesRow/)
  assert.match(runtime, /if \(imageOccupiesRow\(editor, targetRow, rows\)\) return null/)
  assert.doesNotMatch(runtime, /imageAllowsSideFlow/)
  assert.doesNotMatch(runtime, /sideImageForRow/)
  assert.doesNotMatch(runtime, /imageWidth \+ gutter/)
})

test('text rows are measured independently from image box height', () => {
  assert.match(runtime, /function textRows/)
  assert.match(runtime, /document\.createRange\(\)/)
  assert.match(runtime, /range\.getClientRects\(\)/)
  assert.doesNotMatch(runtime, /scrollHeight - padding/)
})

test('new images reserve their complete measured span in document order', () => {
  assert.match(runtime, /if \(isImageBlock\(block\)\)/)
  assert.match(runtime, /const span = imageRows\(block, rowPx\)/)
  assert.match(runtime, /shiftRowsAtOrAfter\(rows, proposed, span, id\)/)
  assert.match(runtime, /rows\[id\] = proposed/)
  assert.match(runtime, /repairImageBarrier/)
})

test('image height changes continuously update the reserved rows', () => {
  assert.match(runtime, /new ResizeObserver\(sync\)/)
  assert.match(runtime, /imageResizeObserver\.observe\(image\)/)
  assert.match(runtime, /const delta = span - previous\.span/)
  assert.match(runtime, /shiftRowsAtOrAfter\(rows, row \+ previous\.span, delta, id\)/)
  assert.doesNotMatch(runtime, /attributeFilter: \['data-image-alignment', 'data-image-compact', 'style'\]/)
})
