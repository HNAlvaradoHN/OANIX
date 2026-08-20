import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const runtime = readFileSync('src/features/editor/NotebookFreeRowsRuntime.tsx', 'utf8')
const simpleRuntime = readFileSync('src/features/editor/NotebookSimpleImageRuntime.tsx', 'utf8')
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

test('tapping inserts only on a genuinely empty row and all special block areas remain unavailable', () => {
  assert.match(runtime, /insertParagraphAtRow/)
  assert.match(runtime, /if \(rowOccupied\(editor, targetRow, rows\)\) return null/)
  assert.match(runtime, /rows\[blockId\(inserted\)\] = targetRow/)
  assert.match(runtime, /blockedTarget/)
  assert.match(runtime, /data-code-block/)
  assert.match(runtime, /data-checklist-block/)
  assert.match(runtime, /data-contact-block/)
  assert.match(runtime, /data-image-block/)
})

test('Enter is owned by the virtual canvas and creates exactly the next logical row', () => {
  assert.match(runtime, /event\.key !== 'Enter'/)
  assert.match(runtime, /event\.preventDefault\(\)/)
  assert.match(runtime, /const nextRow = row \+ 1/)
  assert.match(runtime, /shiftRowsAfter\(rows, row, 1\)/)
  assert.match(runtime, /rows\[blockId\(inserted\)\] = nextRow/)
  assert.match(runtime, /placeCaret\(inserted\)/)
})

test('all blocks use the same sheet width and no lateral text geometry remains', () => {
  assert.match(runtime, /block\.style\.left = `\$\{padLeft\}px`/)
  assert.match(runtime, /block\.style\.right = `\$\{padRight\}px`/)
  assert.match(runtime, /block\.style\.width = 'auto'/)
  assert.doesNotMatch(runtime, /sideImageForRow/)
  assert.doesNotMatch(runtime, /imageWidth \+ gutter/)
  assert.match(css, /float: none !important/)
})

test('manual visual viewport scrolling is not recentered', () => {
  assert.match(runtime, /keepManualScroll/)
  assert.match(runtime, /stopImmediatePropagation/)
  assert.match(runtime, /visualViewport\?\.addEventListener\('scroll'/)
})

test('mobile dock stays pinned to the visible viewport', () => {
  assert.match(css, /\.mobile-editor-dock/)
  assert.match(css, /bottom: auto !important/)
  assert.match(css, /z-index: 1600 !important/)
  assert.match(css, /opacity: 1 !important/)
  assert.match(css, /visibility: visible !important/)
  assert.match(css, /\.editor-command-panel/)
  assert.match(simpleRuntime, /dock\.style\.setProperty\('top'/)
  assert.match(simpleRuntime, /panel\.style\.setProperty\('top'/)
  assert.match(simpleRuntime, /window\.visualViewport/)
})
