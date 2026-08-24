import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const trailing = readFileSync('src/features/editor/editorTrailingWorkspace.css', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

test('mobile note keeps a real editable zone after large blocks', () => {
  assert.match(trailing, /p\[data-oanix-trailing-caret='true'\]:last-child[\s\S]*min-height: clamp\(14rem, 36dvh, 24rem\) !important/)
  assert.match(trailing, /p\[data-oanix-trailing-caret='true'\]:last-child[\s\S]*cursor: text !important/)
  assert.match(trailing, /\.editor-surface::after[\s\S]*min-height: clamp\(6rem, 14dvh, 10rem\)/)
})

test('mobile note preserves scroll clearance above the floating dock', () => {
  assert.match(trailing, /padding-bottom: max\(18rem, calc\(32dvh \+ env\(safe-area-inset-bottom\)\)\) !important/)
  assert.match(trailing, /scroll-padding-bottom: max\(16rem, 28dvh\) !important/)
  assert.match(trailing, /scroll-margin-bottom: max\(16rem, 30dvh\)/)
})

test('trailing workspace styles load with the unlocked workspace runtime', () => {
  assert.match(gate, /import '\.\.\/features\/editor\/editorTrailingWorkspace\.css'/)
})
