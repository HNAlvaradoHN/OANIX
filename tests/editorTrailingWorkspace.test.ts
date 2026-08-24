import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const polish = readFileSync('src/features/editor/editorOperationPolish.css', 'utf8')

test('mobile editor exposes a real trailing writing zone below large blocks', () => {
  assert.match(polish, /p\[data-oanix-trailing-caret='true'\]:last-child[\s\S]*min-height: clamp\(14rem, 36dvh, 24rem\) !important/)
  assert.match(polish, /p\[data-oanix-trailing-caret='true'\]:last-child[\s\S]*cursor: text !important/)
  assert.match(polish, /\.editor-surface::after[\s\S]*min-height: clamp\(6rem, 14dvh, 10rem\)/)
})

test('mobile editor keeps enough bottom scroll clearance above the floating dock', () => {
  assert.match(polish, /\.notes-shell--open \.note-canvas[\s\S]*padding-bottom: max\(18rem, calc\(32dvh \+ env\(safe-area-inset-bottom\)\)\) !important/)
  assert.match(polish, /scroll-padding-bottom: max\(16rem, 28dvh\)/)
})
