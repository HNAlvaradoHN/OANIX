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

test('mobile editor dock stays fixed to the visible viewport above the keyboard', () => {
  assert.doesNotMatch(runtime, /window\.visualViewport/)
  assert.doesNotMatch(runtime, /--oanix-keyboard-inset/)
  assert.match(css, /bottom: max\(\.7rem, env\(safe-area-inset-bottom\)\) !important/)
  assert.match(css, /bottom: calc\(max\(\.7rem, env\(safe-area-inset-bottom\)\) \+ 4\.5rem\) !important/)
  assert.doesNotMatch(css, /--oanix-keyboard-inset/)
})
