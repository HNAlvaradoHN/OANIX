import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const trailing = readFileSync('src/features/editor/editorTrailingWorkspace.css', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

test('mobile note extends the real document flow below large editor blocks', () => {
  assert.match(trailing, /\.note-canvas::after[\s\S]*display: block/)
  assert.match(trailing, /\.note-canvas::after[\s\S]*height: clamp\(18rem, 46dvh, 30rem\)/)
  assert.match(trailing, /\.notes-shell--open > \.note-view[\s\S]*height: auto !important/)
  assert.match(trailing, /\.notes-shell--open > \.note-view[\s\S]*overflow: visible !important/)
})

test('mobile note preserves clearance above the floating editor dock', () => {
  assert.match(trailing, /scroll-padding-bottom: max\(18rem, 42dvh\)/)
  assert.match(trailing, /scroll-margin-bottom: max\(14rem, 30dvh\)/)
})

test('trailing workspace styles load with the unlocked workspace runtime', () => {
  assert.match(gate, /import '\.\.\/features\/editor\/editorTrailingWorkspace\.css'/)
})
