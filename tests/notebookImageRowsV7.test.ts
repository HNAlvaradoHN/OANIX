import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/editor/NotebookFreeRowsRuntime.tsx', 'utf8')

test('virtual row runtime recognizes every interactive reserved notebook block', () => {
  assert.match(runtime, /oanix\.notebook\.rows\.v9/)
  assert.match(runtime, /function isReservedBlock/)
  assert.match(runtime, /dataset\.imageBlock/)
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

test('new reserved blocks use the selected empty row itself and push later rows only by the extra height', () => {
  assert.match(runtime, /RESERVED_INSERT_SELECTOR/)
  assert.match(runtime, /selectionDirectBlock/)
  assert.match(runtime, /placePendingReservedAfterAnchor/)
  assert.match(runtime, /pendingAnchorIds/)
  assert.match(runtime, /function isEmptyInsertionParagraph/)
  assert.match(runtime, /if \(isEmptyInsertionParagraph\(previous\)\)/)
  assert.match(runtime, /insertionRow = previousRow/)
  assert.match(runtime, /replacedRows = blockRows\(previous, rowPx\)/)
  assert.match(runtime, /previous\.remove\(\)/)
  assert.match(runtime, /const extraRows = Math\.max\(0, span - replacedRows\)/)
  assert.match(runtime, /shiftRowsAtOrAfter\(rows, insertionRow \+ replacedRows, extraRows, id\)/)
  assert.match(runtime, /rows\[id\] = insertionRow/)
})

test('consuming an empty insertion row is persisted back to the note model', () => {
  assert.match(runtime, /oanixConsumedInsertionParagraph/)
  assert.match(runtime, /delete editor\.dataset\.oanixConsumedInsertionParagraph/)
  assert.match(runtime, /queueMicrotask/)
  assert.match(runtime, /editor\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/)
})

test('the physical vertical band of a visible reserved block rejects free text immediately', () => {
  assert.match(runtime, /function reservedBlockOwnsClientY/)
  assert.match(runtime, /clientY >= rect\.top && clientY < rect\.bottom/)
  assert.match(runtime, /if \(reservedBlockOwnsClientY\(editor, event\.clientY\)\) return/)
  assert.match(runtime, /if \(rowOccupied\(editor, targetRow, rows\)\) return null/)
})

test('height changes of images code checklists and contacts continuously update reservations', () => {
  assert.match(runtime, /new ResizeObserver\(sync\)/)
  assert.match(runtime, /observedReservedBlocks/)
  assert.match(runtime, /reservedResizeObserver\.observe\(block\)/)
  assert.match(runtime, /const delta = span - previous\.span/)
  assert.match(runtime, /shiftRowsAtOrAfter\(rows, row \+ previous\.span, delta, id\)/)
})

test('removing a reserved block releases its cells without collapsing later content upward', () => {
  assert.match(runtime, /Removing a special block releases its exact rows/)
  assert.match(runtime, /delete rows\[id\]/)
  assert.doesNotMatch(runtime, /shiftRowsAtOrAfter\(rows, state\.row \+ state\.span, -state\.span, id\)/)
})

test('a final document-order guard prevents any later block from overlapping a reserved block', () => {
  assert.match(runtime, /function repairBlockOrderOverlaps/)
  assert.match(runtime, /let nextAvailableRow = 0/)
  assert.match(runtime, /const row = Math\.max\(savedRow, nextAvailableRow\)/)
  assert.match(runtime, /nextAvailableRow = row \+ blockRows\(block, rowPx\)/)
  assert.match(runtime, /const overlapsRepaired = repairBlockOrderOverlaps\(editor, rows\)/)
  assert.match(runtime, /pendingPlaced \|\| assigned \|\| reservedChanged \|\| overlapsRepaired/)
})
