import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const compactContract = readFileSync('src/features/notes/compactNoteContract.css', 'utf8')
const visualRuntime = readFileSync('src/features/notes/V383WorkspaceVisualRuntime.tsx', 'utf8')
const main = readFileSync('src/main.tsx', 'utf8')

test('compact note rows reserve separate icon, text and metadata zones', () => {
  assert.match(compactContract, /padding:\s*12px clamp\(160px, 44vw, 230px\) 10px 64px !important/)
  assert.match(compactContract, /max-width:\s*min\(30vw, 180px\) !important/)
  assert.match(compactContract, /place-items:\s*center !important/)
  assert.match(compactContract, /transform:\s*translateY\(-1px\) !important/)
  assert.ok(!main.includes("features/notes/compactNoteContract.css"))
  assert.ok(visualRuntime.includes("import './compactNoteContract.css'"))
  assert.ok(!main.includes('compactNotePolish.css'))
})
