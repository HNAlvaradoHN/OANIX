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
  assert.match(css, /block the complete writing width/)
  assert.match(css, /Text can exist above or below the image, never beside it/)
  assert.match(css, /editor-image-block__alignment/)
  assert.match(css, /display: none !important/)
})

test('image normalization cannot observe and rewrite the same attributes forever', () => {
  assert.match(runtime, /childList: true/)
  assert.match(runtime, /subtree: true/)
  assert.doesNotMatch(runtime, /attributes: true/)
  assert.doesNotMatch(runtime, /attributeFilter/)
})

test('full-width image stays pinned when logical rows absolutely position it', () => {
  assert.match(css, /data-oanix-notebook-full-width='true'/)
  assert.match(css, /left: clamp\(1\.15rem, 3vw, 2rem\) !important/)
  assert.match(css, /right: clamp\(1\.15rem, 3vw, 2rem\) !important/)
  assert.match(css, /transform: none !important/)
})

test('mobile image card is vertical with full-width preview and description below', () => {
  assert.match(css, /display: flex !important/)
  assert.match(css, /flex-direction: column !important/)
  assert.match(css, /editor-image-block__preview/)
  assert.match(css, /width: 100% !important/)
  assert.match(css, /editor-image-block__footer/)
  assert.match(css, /border-top: 1px solid/)
  assert.match(css, /border-left: 0 !important/)
  assert.match(css, /editor-image-block__alt/)
  assert.match(css, /min-height: 2\.65rem !important/)
  assert.doesNotMatch(css, /grid-template-columns: minmax\(0, 1\.75fr\) minmax\(7\.6rem, \.9fr\)/)
  assert.doesNotMatch(css, /display: contents !important/)
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
