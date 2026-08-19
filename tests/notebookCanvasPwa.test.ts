import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const runtime = readFileSync('src/features/editor/NotebookCanvasRuntime.tsx', 'utf8')
const css = readFileSync('src/styles/notebook-canvas.css', 'utf8')

test('notebook canvas preview is PWA-only until Android is approved', () => {
  assert.match(main, /!isCapacitorBuild && <NotebookCanvasRuntime \/>/)
  assert.doesNotMatch(main, /NotebookPaperPreference/)
  assert.match(runtime, /import\.meta\.env\.MODE === 'capacitor'/)
})

test('plain and ruled paper share one internal 32px row rhythm per note', () => {
  assert.match(runtime, /type PaperMode = 'plain' \| 'ruled'/)
  assert.match(runtime, /NOTE_PAPER_STORAGE_KEY = 'oanix\.note\.paper\.v1'/)
  assert.match(runtime, /dataset\.oanixPaperMode/)
  assert.match(css, /--oanix-notebook-row: 32px/)
  assert.match(css, /data-oanix-paper-mode='plain'/)
  assert.match(css, /data-oanix-paper-mode='ruled'/)
  assert.match(css, /background-size: 100% var\(--oanix-notebook-row\)/)
})

test('blank sheet taps create a start-of-row caret and keep it above the keyboard', () => {
  assert.match(runtime, /insertCaretAtCanvasPoint/)
  assert.match(runtime, /canvasStartY/)
  assert.match(runtime, /placeCaretAtStart\(paragraph\)/)
  assert.match(runtime, /data-oanix-leading-rows|oanixLeadingRows/)
  assert.match(runtime, /visualViewport\?\.addEventListener\('resize'/)
  assert.match(runtime, /scrollIntoView\(\{ block: 'center'/)
})

test('side-aligned compact images allow real text flow while centered images remain block-level', () => {
  assert.match(runtime, /imageContextAtPoint/)
  assert.match(runtime, /alignment === 'center' \|\| !compact/)
  assert.match(runtime, /insertCaretBesideImage/)
  assert.match(css, /data-image-compact='true'\]\[data-image-alignment='left'\]/)
  assert.match(css, /float: left/)
  assert.match(css, /data-image-compact='true'\]\[data-image-alignment='right'\]/)
  assert.match(css, /float: right/)
  assert.match(css, /data-image-alignment='center'/)
  assert.match(css, /clear: both/)
})

test('normal prose does not hyphenate or split words artificially', () => {
  assert.match(css, /hyphens: none/)
  assert.match(css, /word-break: normal/)
  assert.match(css, /overflow-wrap: normal/)
  assert.match(css, /\.editor-surface a[\s\S]*overflow-wrap: anywhere/)
})
