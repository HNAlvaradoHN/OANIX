import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/editor/NotebookCanvasRuntime.tsx', 'utf8')
const notebookCss = readFileSync('src/styles/notebook-canvas.css', 'utf8')
const brandCss = readFileSync('src/styles/web-brand-logo.css', 'utf8')

test('blank notebook taps work on the editor background and empty paragraphs', () => {
  assert.match(runtime, /target\.closest<HTMLElement>\('\.editor-surface'\)/)
  assert.match(runtime, /return emptyParagraph\(direct\) \? editor : null/)
  assert.match(runtime, /oanix\.notebook\.layout\.v3/)
})

test('mobile side images keep real text flow instead of forced block layout', () => {
  assert.match(notebookCss, /data-image-alignment='left'[\s\S]*?float:\s*left\s*!important/)
  assert.match(notebookCss, /data-image-alignment='right'[\s\S]*?float:\s*right\s*!important/)
  assert.match(notebookCss, /data-image-alignment='right'\] \+ p[\s\S]*?clear:\s*none\s*!important/)
})

test('ruled paper is visible and locked to the 32px writing rhythm', () => {
  assert.match(notebookCss, /--oanix-notebook-row:\s*32px/)
  assert.match(notebookCss, /--oanix-notebook-line:/)
  assert.match(notebookCss, /background-size:\s*100% var\(--oanix-notebook-row\)/)
})

test('image option sheet reserves space and is recentered above the mobile dock', () => {
  assert.match(runtime, /syncImagePanelGeometry/)
  assert.match(runtime, /centerImageAbovePanel/)
  assert.match(notebookCss, /data-oanix-image-panel-open='true'[\s\S]*?padding-bottom:/)
})

test('PWA internal logo animation stays subtle and respects reduced motion', () => {
  assert.match(brandCss, /oanix-brand-float 5\.8s ease-in-out infinite/)
  assert.match(brandCss, /oanix-brand-sheen 7\.2s ease-in-out infinite/)
  assert.match(brandCss, /prefers-reduced-motion:[\s\S]*?animation:\s*none\s*!important/)
})
