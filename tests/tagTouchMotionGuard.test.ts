import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const guard = readFileSync('src/features/notes/organicWorkspaceTouchMotion.css', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

test('tag control arrows use one static motion authority on every pointer type', () => {
  assert.match(guard, /^\.oanix-organic-tags__arrows\s*\{[^}]*animation:\s*none\s*!important/m)
  assert.doesNotMatch(guard, /html\.oanix-v383-visual \.oanix-organic-tags__arrows/)
  assert.doesNotMatch(guard, /@media \(pointer: coarse\)/)
  assert.doesNotMatch(gate, /tagTouchMotionGuard\.css/)
})
