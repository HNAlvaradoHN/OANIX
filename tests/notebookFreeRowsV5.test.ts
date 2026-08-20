import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const runtime = readFileSync('src/features/editor/NotebookFreeRowsRuntime.tsx', 'utf8')
const css = readFileSync('src/styles/notebook-logical-rows-v6.css', 'utf8')

test('free-row runtime stays PWA-only and uses stable logical row metadata', () => {
  assert.match(main, /NotebookFreeRowsRuntime/)
  assert.match(main, /notebook-logical-rows-v6\.css/)
  assert.match(runtime, /import\.meta\.env\.MODE === 'capacitor'/)
  assert.match(runtime, /oanix\.notebook\.rows\.v7/)
  assert.match(runtime, /data.*oanixLogicalRow|oanixLogicalRow/)
})

test('inserting into an empty row does not renumber the paragraph below', () => {
  assert.match(runtime, /insertParagraphAtRow/)
  assert.match(runtime, /rows\[blockId\(inserted\)\] = targetRow/)
  assert.match(runtime, /rows\[id\] \?\? previousBottomRow/)
  assert.doesNotMatch(runtime, /rows - targetRow - 1/)
})

test('Enter is the explicit operation allowed to move later logical rows', () => {
  assert.match(runtime, /event\.key !== 'Enter'/)
  assert.match(runtime, /shiftRowsAfter\(rows, row, 1\)/)
})

test('manual visual viewport scrolling is not recentered by the legacy caret guard', () => {
  assert.match(runtime, /allowManualViewportScroll/)
  assert.match(runtime, /stopImmediatePropagation/)
  assert.match(runtime, /visualViewport\?\.addEventListener\('scroll'/)
})

test('mobile dock does not double-count keyboard inset while the note scrolls', () => {
  assert.match(css, /\.mobile-editor-dock/)
  assert.match(css, /bottom: max\(\.7rem, env\(safe-area-inset-bottom\)\) !important/)
  assert.doesNotMatch(css, /mobile-editor-dock[\s\S]*oanix-keyboard-inset/)
})
