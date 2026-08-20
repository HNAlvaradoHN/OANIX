import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const runtime = readFileSync('src/features/editor/NotebookFreeRowsRuntime.tsx', 'utf8')
const css = readFileSync('src/styles/notebook-canvas.css', 'utf8')

test('free-row runtime is enabled only in the PWA path', () => {
  assert.match(main, /NotebookFreeRowsRuntime/)
  assert.match(main, /!isCapacitorBuild && <NotebookFreeRowsRuntime \/>/)
  assert.match(runtime, /import\.meta\.env\.MODE === 'capacitor'/)
})

test('clicking an anchored gap splits it without pushing the paragraph below', () => {
  assert.match(runtime, /paragraphPaddingHit/)
  assert.match(runtime, /splitAnchoredGap/)
  assert.match(runtime, /rows - targetRow - 1/)
  assert.match(runtime, /next\.before\(inserted\)/)
  assert.match(runtime, /setLeadingRows\(inserted, targetRow/)
})

test('manual visual viewport scrolling is not recentered by the legacy caret guard', () => {
  assert.match(runtime, /allowManualViewportScroll/)
  assert.match(runtime, /stopImmediatePropagation/)
  assert.match(runtime, /visualViewport\?\.addEventListener\('scroll'/)
})

test('focused mobile notes keep a long writable tail without fake stored rows', () => {
  assert.match(css, /min-height: max\(110rem, calc\(100dvh \+ 72rem\)\)/)
  assert.match(css, /padding-bottom: max\(24rem, 70dvh\)/)
})
