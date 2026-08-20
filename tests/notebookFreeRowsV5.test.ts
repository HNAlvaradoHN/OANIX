import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const runtime = readFileSync('src/features/editor/NotebookFreeRowsRuntime.tsx', 'utf8')
const css = readFileSync('src/styles/notebook-logical-rows-v6.css', 'utf8')

test('free-row runtime stays PWA-only and uses v9 logical row metadata', () => {
  assert.match(main, /NotebookFreeRowsRuntime/)
  assert.match(main, /notebook-logical-rows-v6\.css/)
  assert.match(runtime, /import\.meta\.env\.MODE === 'capacitor'/)
  assert.match(runtime, /oanix\.notebook\.rows\.v9/)
  assert.match(runtime, /oanixLogicalRow/)
})

test('the note is a growing virtual canvas rather than padding-owned gaps', () => {
  assert.match(runtime, /EDIT_ROWS = 240/)
  assert.match(runtime, /applyVirtualCanvas/)
  assert.match(runtime, /data.*oanixVirtualCanvas|oanixVirtualCanvas/)
  assert.match(runtime, /block\.style\.position = 'absolute'/)
  assert.doesNotMatch(runtime, /style\.paddingTop/)
  assert.match(css, /data-oanix-virtual-canvas/)
})

test('tapping an empty logical row inserts there without moving unrelated rows', () => {
  assert.match(runtime, /insertParagraphAtRow/)
  assert.match(runtime, /rows\[blockId\(inserted\)\] = targetRow/)
  assert.match(runtime, /paragraphOccupiesRow/)
  assert.match(runtime, /blockingImageOccupiesRow/)
})

test('Enter remains the explicit operation allowed to move later logical rows', () => {
  assert.match(runtime, /event\.key !== 'Enter'/)
  assert.match(runtime, /shiftRowsAfter\(rows, row, 1\)/)
})

test('compact side images constrain only the text rows they overlap', () => {
  assert.match(runtime, /sideImageForRow/)
  assert.match(runtime, /imageAllowsSideFlow/)
  assert.match(runtime, /imageWidth \+ gutter/)
  assert.match(css, /float: none !important/)
})

test('manual visual viewport scrolling is not recentered', () => {
  assert.match(runtime, /keepManualScroll/)
  assert.match(runtime, /stopImmediatePropagation/)
  assert.match(runtime, /visualViewport\?\.addEventListener\('scroll'/)
})

test('mobile dock stays pinned to the top of the visible viewport', () => {
  assert.match(css, /\.mobile-editor-dock/)
  assert.match(css, /top: calc\(\.7rem \+ env\(safe-area-inset-top\)\) !important/)
  assert.match(css, /bottom: auto !important/)
  assert.match(css, /\.editor-command-panel/)
})
