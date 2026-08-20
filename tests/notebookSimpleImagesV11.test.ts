import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const runtime = readFileSync('src/features/editor/NotebookSimpleImageRuntime.tsx', 'utf8')
const css = readFileSync('src/styles/notebook-logical-rows-v6.css', 'utf8')

test('PWA notebook images are normalized to one full-width atomic mode', () => {
  assert.match(main, /NotebookSimpleImageRuntime/)
  assert.match(runtime, /image\.contentEditable = 'false'/)
  assert.match(runtime, /image\.dataset\.imageCompact = 'false'/)
  assert.match(runtime, /image\.dataset\.imageAlignment = 'center'/)
  assert.match(runtime, /oanixNotebookFullWidth/)
  assert.match(css, /atomic document blocks/)
  assert.match(css, /never beside or through it/)
})

test('obsolete move, resize and lock controls are removed while normal image actions remain', () => {
  assert.match(runtime, /data-image-lock/)
  assert.match(runtime, /data-image-align/)
  assert.match(runtime, /data-image-resize/)
  assert.match(runtime, /editor-image-block__alignment/)
  assert.match(runtime, /data-image-open-action/)
  assert.match(css, /editor-image-block__lock/)
  assert.match(css, /display: none !important/)
})

test('image normalization cannot observe and rewrite the same attributes forever', () => {
  assert.match(runtime, /childList: true/)
  assert.match(runtime, /subtree: true/)
  assert.doesNotMatch(runtime, /attributes: true/)
  assert.doesNotMatch(runtime, /attributeFilter/)
})

test('full-width card contains portrait and landscape images without stretching them', () => {
  assert.match(css, /data-oanix-notebook-full-width='true'/)
  assert.match(css, /left: clamp\(1\.15rem, 3vw, 2rem\) !important/)
  assert.match(css, /right: clamp\(1\.15rem, 3vw, 2rem\) !important/)
  assert.match(css, /transform: none !important/)
  assert.match(css, /width: auto !important/)
  assert.match(css, /max-width: 100% !important/)
  assert.match(css, /height: auto !important/)
  assert.match(css, /max-height: 28rem !important/)
  assert.match(css, /max-height: 20rem !important/)
  assert.match(css, /object-position: left top !important/)
  assert.doesNotMatch(css, /max-height: none !important/)
})

test('description and controls stay below the image without horizontal card columns', () => {
  assert.match(css, /editor-image-block__footer/)
  assert.match(css, /flex-direction: column !important/)
  assert.match(css, /editor-image-block__details/)
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) !important/)
  assert.match(css, /editor-image-block__alt/)
  assert.match(css, /min-height: 2\.65rem !important/)
  assert.doesNotMatch(css, /grid-template-columns: minmax\(0, 1\.75fr\) minmax\(7\.6rem, \.9fr\)/)
  assert.doesNotMatch(css, /display: contents !important/)
})

test('text deletion cannot consume an adjacent or selected atomic image', () => {
  assert.match(runtime, /protectAtomicImageFromTextDeletion/)
  assert.match(runtime, /event\.key !== 'Backspace'/)
  assert.match(runtime, /event\.key !== 'Delete'/)
  assert.match(runtime, /selectionTouchesImage/)
  assert.match(runtime, /previousElementSibling\.dataset\.imageBlock === 'true'/)
  assert.match(runtime, /nextElementSibling\.dataset\.imageBlock === 'true'/)
  assert.match(runtime, /event\.stopImmediatePropagation\(\)/)
})

test('legacy preview dragging is blocked and tapping the image opens it normally', () => {
  assert.match(runtime, /stopImageDrag/)
  assert.match(runtime, /event\.stopPropagation\(\)/)
  assert.match(runtime, /openImageFromPreview/)
  assert.match(runtime, /open\.click\(\)/)
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
