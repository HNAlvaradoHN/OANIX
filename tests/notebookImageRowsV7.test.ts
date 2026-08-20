import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/editor/NotebookFreeRowsRuntime.tsx', 'utf8')

test('logical row runtime integrates image blocks into the same row map', () => {
  assert.match(runtime, /oanix\.notebook\.rows\.v7/)
  assert.match(runtime, /directLayoutBlocks/)
  assert.match(runtime, /data-image-block/)
  assert.match(runtime, /syncImageRows/)
  assert.match(runtime, /imageStates/)
})

test('compact side images do not consume full notebook rows', () => {
  assert.match(runtime, /imageAllowsSideFlow/)
  assert.match(runtime, /imageCompact/)
  assert.match(runtime, /imageAlignment === 'left'/)
  assert.match(runtime, /imageAlignment === 'right'/)
  assert.match(runtime, /if \(!imageAllowsSideFlow\(block\)\)/)
})

test('center or large images block row insertion while side-flow images keep free rows writable', () => {
  assert.match(runtime, /blockingImageOccupiesRow/)
  assert.match(runtime, /if \(blockingImageOccupiesRow\(editor, targetRow, rowPx\)\) return null/)
})

test('changing image layout adjusts following logical rows instead of corrupting paragraph anchors', () => {
  assert.match(runtime, /existing\.blocking && blocking/)
  assert.match(runtime, /!existing\.blocking && blocking/)
  assert.match(runtime, /existing\.blocking && !blocking/)
  assert.match(runtime, /shiftRowsAtOrAfter/)
})
