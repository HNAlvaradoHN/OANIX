import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const guard = readFileSync('src/features/tags/tagTouchMotionGuard.css', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

test('tag control arrows stop continuous motion on coarse pointers only', () => {
  assert.match(guard, /@media \(pointer: coarse\)/)
  assert.match(guard, /\.oanix-organic-tags__arrows[\s\S]*animation:\s*none\s*!important/)
  assert.match(gate, /tagTouchMotionGuard\.css/)
})
