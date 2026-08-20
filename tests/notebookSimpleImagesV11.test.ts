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

test('mobile image card prioritizes preview at left and keeps options readable at right', () => {
  assert.match(css, /grid-template-columns: minmax\(0, 1\.75fr\) minmax\(7\.6rem, \.9fr\)/)
  assert.match(css, /editor-image-block__preview/)
  assert.match(css, /grid-column: 1 !important/)
  assert.match(css, /editor-image-block__footer/)
  assert.match(css, /grid-column: 2 !important/)
  assert.match(css, /editor-image-block__resize/)
  assert.match(css, /display: none !important/)
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
