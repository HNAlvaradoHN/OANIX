import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const trailing = readFileSync('src/features/editor/editorTrailingWorkspace.css', 'utf8')
const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')
const workspaceGate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

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

test('mobile note keeps physical runway separate from automatic focus clearance', () => {
  assert.match(trailing, /\.notes-shell--open > \.note-view \{[\s\S]*scroll-padding-bottom: calc\(7rem \+ env\(safe-area-inset-bottom\)\)/)
  assert.match(trailing, /scroll-margin-bottom: calc\(7rem \+ env\(safe-area-inset-bottom\)\)/)
  assert.match(trailing, /\.note-canvas::after[\s\S]*height: max\(36rem, 110dvh\)/)
  assert.doesNotMatch(trailing, /scroll-padding-bottom: max\(36rem, 110dvh\)/)
  assert.doesNotMatch(trailing, /scroll-margin-bottom: max\(28rem, 82dvh\)/)
  assert.match(trailing, /data-oanix-trailing-caret/)
})

test('legacy trailing workspace styles stay in the lazy fallback and out of Workspace V2', () => {
  assert.match(legacyGate, /import '\.\.\/features\/editor\/editorTrailingWorkspace\.css'/)
  assert.doesNotMatch(workspaceGate, /editorTrailingWorkspace\.css/)
})
