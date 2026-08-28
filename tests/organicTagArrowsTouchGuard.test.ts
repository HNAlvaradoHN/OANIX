import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')
const visualRuntime = readFileSync('src/features/notes/V383WorkspaceVisualRuntime.tsx', 'utf8')
const workspace = readFileSync('src/features/notes/organicWorkspace.css', 'utf8')
const v383 = readFileSync('src/features/notes/v383WorkspaceVisual.css', 'utf8')
const guard = readFileSync('src/features/notes/organicWorkspaceTouchMotion.css', 'utf8')

test('organic tag reorder arrows remain visible without perpetual idle animation', () => {
  assert.doesNotMatch(main, /organicWorkspaceTouchMotion\.css/)
  assert.doesNotMatch(legacyGate, /organicWorkspaceTouchMotion\.css/)
  assert.match(visualRuntime, /import '\.\/organicWorkspaceTouchMotion\.css'/)
  assert.match(workspace, /\.oanix-organic-tags__arrows/)
  assert.match(v383, /html\.oanix-v383-visual\s+\.oanix-organic-tags__arrows/)
  assert.match(guard, /html\.oanix-v383-visual\s+\.oanix-organic-tags__arrows,[\s\S]*\.oanix-organic-tags__arrows\s*\{[^}]*animation:\s*none\s*!important/)
  assert.doesNotMatch(guard, /@media \(pointer: coarse\)/)
})
