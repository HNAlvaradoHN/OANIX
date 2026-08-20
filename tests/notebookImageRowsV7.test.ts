import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/editor/NotebookFreeRowsRuntime.tsx', 'utf8')

test('virtual row runtime recognizes every interactive reserved notebook block', () => {
  assert.match(runtime, /oanix\.notebook\.rows\.v9/)
  assert.match(runtime, /function isReservedBlock/)
  assert.match(runtime, /data.*imageBlock|dataset\.imageBlock/)
  assert.match(runtime, /dataset\.codeBlock/)
  assert.match(runtime, /dataset\.checklistBlock/)
  assert.match(runtime, /dataset\.contactBlock/)
  assert.match(runtime, /syncReservedBlockReservations/)
  assert.match(runtime, /reservedStates/)
})

test('reserved blocks use their complete physical height instead of text line rectangles', () => {
  assert.match(runtime, /function reservedBlockRows/)
  assert.match(runtime, /getBoundingClientRect\(\)\.height/)
  assert.match(runtime, /block\.offsetHeight/)
  assert.match(runtime, /Math\.ceil\(height \/ rowPx\)/)
  assert.match(runtime, /isReservedBlock\(block\) \? reservedBlockRows\(block, rowPx\) : textRows/)
})

test('ordinary text keeps line-based measurement while special cards stay atomic', () => {
  assert.match(runtime, /function textRows/)
  assert.match(runtime, /document\.createRange\(\)/)
  assert.match(runtime, /range\.getClientRects\(\)/)
  assert.doesNotMatch(runtime, /imageAllowsSideFlow/)
  assert.doesNotMatch(runtime, /sideImageForRow/)
})

test('new reserved blocks push all later logical rows below their complete box', () => {
  assert.match(runtime, /if \(isReservedBlock\(block\)\)/)
  assert.match(runtime, /const span = reservedBlockRows\(block, rowPx\)/)
  assert.match(runtime, /shiftRowsAtOrAfter\(rows, proposed, span, id\)/)
  assert.match(runtime, /rows\[id\] = proposed/)
  assert.match(runtime, /repairReservedBarrier/)
})

test('height changes of images code checklists and contacts continuously update reservations', () => {
  assert.match(runtime, /new ResizeObserver\(sync\)/)
  assert.match(runtime, /observedReservedBlocks/)
  assert.match(runtime, /reservedResizeObserver\.observe\(block\)/)
  assert.match(runtime, /const delta = span - previous\.span/)
  assert.match(runtime, /shiftRowsAtOrAfter\(rows, row \+ previous\.span, delta, id\)/)
})

test('a final document-order guard prevents any later block from overlapping a reserved block', () => {
  assert.match(runtime, /function repairBlockOrderOverlaps/)
  assert.match(runtime, /let nextAvailableRow = 0/)
  assert.match(runtime, /const row = Math\.max\(savedRow, nextAvailableRow\)/)
  assert.match(runtime, /nextAvailableRow = row \+ blockRows\(block, rowPx\)/)
  assert.match(runtime, /const overlapsRepaired = repairBlockOrderOverlaps\(editor, rows\)/)
  assert.match(runtime, /assigned \|\| reservedChanged \|\| overlapsRepaired/)
})
