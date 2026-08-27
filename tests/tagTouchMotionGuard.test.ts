import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const guard = readFileSync('src/features/notes/organicWorkspaceTouchMotion.css', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

test('tag control arrows use one coarse-pointer motion authority', () => {
  assert.match(guard, /@media \(pointer: coarse\)/)
  assert.match(guard, /html\.oanix-v383-visual \.oanix-organic-tags__arrows[\s\S]*animation:\s*none\s*!important/)
  assert.doesNotMatch(gate, /tagTouchMotionGuard\.css/)
})
