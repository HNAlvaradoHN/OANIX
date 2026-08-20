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
  assert.match(css, /full writing width/)
  assert.match(css, /editor-image-block__alignment/)
  assert.match(css, /display: none !important/)
})

test('mobile editor dock tracks the software keyboard instead of the document scroll', () => {
  assert.match(runtime, /window\.visualViewport/)
  assert.match(runtime, /--oanix-keyboard-inset/)
  assert.match(runtime, /visualViewport\?\.addEventListener\('resize'/)
  assert.match(css, /bottom: calc\(var\(--oanix-keyboard-inset, 0px\) \+ \.7rem\) !important/)
  assert.match(css, /bottom: calc\(var\(--oanix-keyboard-inset, 0px\) \+ 5\.2rem\) !important/)
})
