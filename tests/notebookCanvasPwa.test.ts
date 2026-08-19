import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const runtime = readFileSync('src/features/editor/NotebookCanvasRuntime.tsx', 'utf8')
const preference = readFileSync('src/features/personalization/notebookPaper.ts', 'utf8')
const preferenceUi = readFileSync('src/features/personalization/NotebookPaperPreference.tsx', 'utf8')
const css = readFileSync('src/styles/notebook-canvas.css', 'utf8')

test('notebook canvas preview is PWA-only until Android is approved', () => {
  assert.match(main, /!isCapacitorBuild && <NotebookCanvasRuntime \/>/)
  assert.match(main, /!isCapacitorBuild && <NotebookPaperPreference \/>/)
  assert.match(runtime, /import\.meta\.env\.MODE === 'capacitor'/)
})

test('plain and ruled paper share one internal 32px row rhythm', () => {
  assert.match(preference, /type NotebookPaperMode = 'plain' \| 'ruled'/)
  assert.match(css, /--oanix-notebook-row: 32px/)
  assert.match(css, /oanix-paper-plain \.editor-surface/)
  assert.match(css, /oanix-paper-ruled \.editor-surface/)
  assert.match(preferenceUi, /Cuadrícula invisible/)
  assert.match(preferenceUi, /Renglones alineados al texto/)
})

test('blank sheet taps create a start-of-row caret and keep it above the keyboard', () => {
  assert.match(runtime, /insertCaretAtBackgroundPoint/)
  assert.match(runtime, /placeCaretAtStart\(paragraph\)/)
  assert.match(runtime, /data-oanix-leading-rows|oanixLeadingRows/)
  assert.match(runtime, /visualViewport\?\.addEventListener\('resize'/)
  assert.match(runtime, /scrollIntoView\(\{ block: 'center'/)
})

test('side-aligned compact images allow real text flow while centered images remain block-level', () => {
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
