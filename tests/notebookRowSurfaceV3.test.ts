import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const runtime = readFileSync('src/features/editor/NotebookCanvasRuntime.tsx', 'utf8')
const css = readFileSync('src/styles/notebook-canvas.css', 'utf8')

test('paper style is controlled per note instead of from global personalization', () => {
  assert.doesNotMatch(main, /NotebookPaperPreference/)
  assert.doesNotMatch(main, /applyNotebookPaperMode/)
  assert.match(runtime, /oanix\.note\.paper\.v1/)
  assert.match(runtime, /noteKeyForEditor/)
  assert.match(runtime, /data-oanix-note-paper-toggle/)
  assert.match(css, /data-oanix-paper-mode='ruled'/)
  assert.match(css, /data-oanix-paper-mode='plain'/)
})

test('the whole empty canvas can create a row without requiring previous text', () => {
  assert.match(runtime, /insertCaretAtCanvasPoint/)
  assert.match(runtime, /canvasStartY/)
  assert.match(runtime, /event\.clientX, event\.clientY/)
  assert.match(runtime, /createCaretParagraph/)
  assert.match(runtime, /prepareCaret/)
  assert.match(runtime, /LAYOUT_STORAGE_KEY = 'oanix\.notebook\.layout\.v3'/)
})

test('side images allow row creation while centered images block side writing', () => {
  assert.match(runtime, /imageContextAtPoint/)
  assert.match(runtime, /alignment === 'center' \|\| !compact/)
  assert.match(runtime, /kind: 'side'/)
  assert.match(runtime, /insertCaretBesideImage/)
  assert.match(css, /data-image-alignment='left'/)
  assert.match(css, /data-image-alignment='right'/)
  assert.match(css, /float: left !important/)
  assert.match(css, /float: right !important/)
  assert.match(css, /data-image-alignment='center'/)
  assert.match(css, /float: none !important/)
})

test('ruled mode has a visible repeated 32px writing rhythm', () => {
  assert.match(css, /--oanix-notebook-row: 32px/)
  assert.match(css, /repeating-linear-gradient/)
  assert.match(css, /--oanix-notebook-line/)
  assert.match(css, /background-image: none !important/)
  assert.match(css, /line-height: var\(--oanix-notebook-row\)/)
})
