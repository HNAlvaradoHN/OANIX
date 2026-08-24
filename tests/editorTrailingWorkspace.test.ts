import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const trailing = readFileSync('src/features/editor/editorTrailingWorkspace.css', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

test('mobile note extends the real document flow below large editor blocks', () => {
  assert.match(trailing, /\.note-canvas::after[\s\S]*display: block/)
  assert.match(trailing, /\.note-canvas::after[\s\S]*height: max\(36rem, 110dvh\)/)
})

test('mobile note detail owns viewport scrolling instead of relying on clipped document overflow', () => {
  assert.match(trailing, /\.notes-shell--open \{[\s\S]*height: 100dvh !important[\s\S]*overflow: hidden !important/)
  assert.match(trailing, /\.notes-shell--open > \.note-view \{[\s\S]*height: 100dvh !important/)
  assert.match(trailing, /\.notes-shell--open > \.note-view \{[\s\S]*overflow-y: auto !important/)
  assert.match(trailing, /\.notes-shell--open > \.note-view \{[\s\S]*touch-action: pan-y/)
})

test('mobile note preserves clearance above the floating editor dock when the keyboard shrinks the viewport', () => {
  assert.match(trailing, /\.notes-shell--open > \.note-view \{[\s\S]*scroll-padding-bottom: max\(36rem, 110dvh\)/)
  assert.match(trailing, /scroll-padding-bottom: max\(28rem, 85dvh\) !important/)
  assert.match(trailing, /scroll-margin-bottom: max\(28rem, 82dvh\)/)
  assert.match(trailing, /data-oanix-trailing-caret/)
})

test('trailing workspace styles load with the unlocked workspace runtime', () => {
  assert.match(gate, /import '\.\.\/features\/editor\/editorTrailingWorkspace\.css'/)
})
