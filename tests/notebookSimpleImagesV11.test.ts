import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const runtime = readFileSync('src/features/editor/NotebookSimpleImageRuntime.tsx', 'utf8')
const css = readFileSync('src/styles/notebook-logical-rows-v6.css', 'utf8')

test('PWA notebook images are normalized to one full-width blocking mode', () => {
  assert.match(main, /NotebookSimpleImageRuntime/)
  assert.match(runtime, /image\.dataset\.imageCompact = 'false'/)
  assert.match(runtime, /image\.dataset\.imageAlignment = 'center'/)
  assert.match(runtime, /oanixNotebookFullWidth/)
  assert.match(css, /owns the writing width/)
  assert.match(css, /editor-image-block__alignment/)
  assert.match(css, /display: none !important/)
})

test('image normalization cannot observe and rewrite the same attributes forever', () => {
  assert.match(runtime, /childList: true/)
  assert.match(runtime, /subtree: true/)
  assert.doesNotMatch(runtime, /attributes: true/)
  assert.doesNotMatch(runtime, /attributeFilter/)
})

test('full-width image remains pinned after logical rows switch blocks to absolute positioning', () => {
  assert.match(css, /data-oanix-notebook-full-width='true'/)
  assert.match(css, /left: clamp\(1\.15rem, 3vw, 2rem\) !important/)
  assert.match(css, /right: clamp\(1\.15rem, 3vw, 2rem\) !important/)
  assert.match(css, /transform: none !important/)
})

test('mobile image card keeps preview and actions above a full-width description row', () => {
  assert.match(css, /grid-template-columns: minmax\(0, 1\.55fr\) minmax\(8\.2rem, 1fr\)/)
  assert.match(css, /grid-template-rows: auto auto auto !important/)
  assert.match(css, /editor-image-block__preview/)
  assert.match(css, /grid-row: 1 \/ 3 !important/)
  assert.match(css, /editor-image-block__footer/)
  assert.match(css, /editor-image-block__details/)
  assert.match(css, /display: contents !important/)
  assert.match(css, /editor-image-block__actions/)
  assert.match(css, /grid-column: 2 !important/)
  assert.match(css, /editor-image-block__alt/)
  assert.match(css, /grid-column: 1 \/ -1 !important/)
  assert.match(css, /grid-row: 3 !important/)
  assert.match(css, /overflow-wrap: break-word !important/)
  assert.match(css, /text-overflow: ellipsis !important/)
})

test('mobile editor dock is pinned to the visual viewport across keyboard resize and scroll', () => {
  assert.match(runtime, /window\.visualViewport/)
  assert.match(runtime, /visibleTop/)
  assert.match(runtime, /visibleHeight/)
  assert.match(runtime, /dock\.style\.setProperty\('top'/)
  assert.match(runtime, /panel\.style\.setProperty\('top'/)
  assert.match(runtime, /visualViewport\?\.addEventListener\('resize'/)
  assert.match(runtime, /visualViewport\?\.addEventListener\('scroll'/)
  assert.match(css, /bottom: auto !important/)
})
