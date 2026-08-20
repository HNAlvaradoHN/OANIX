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

test('compact side images do not consume full notebook rows', () => {
  assert.match(runtime, /imageAllowsSideFlow/)
  assert.match(runtime, /imageCompact/)
  assert.match(runtime, /imageAlignment === 'left'/)
  assert.match(runtime, /imageAlignment === 'right'/)
})

test('text rows are measured independently from image box height', () => {
  assert.match(runtime, /function textRows/)
  assert.match(runtime, /document\.createRange\(\)/)
  assert.match(runtime, /range\.getClientRects\(\)/)
  assert.doesNotMatch(runtime, /scrollHeight - padding/)
})

test('center or large images block row insertion while side-flow image rows stay writable', () => {
  assert.match(runtime, /blockingImageOccupiesRow/)
  assert.match(runtime, /if \(blockingImageOccupiesRow\(editor, targetRow, rows\)\) return null/)
  assert.match(runtime, /sideImageForRow/)
})

test('changing image layout adjusts reserved rows without reintroducing paragraph padding gaps', () => {
  assert.match(runtime, /previous\.blocking && blocking/)
  assert.match(runtime, /!previous\.blocking && blocking/)
  assert.match(runtime, /previous\.blocking && !blocking/)
  assert.match(runtime, /shiftRowsAtOrAfter/)
  assert.doesNotMatch(runtime, /style\.paddingTop/)
})
