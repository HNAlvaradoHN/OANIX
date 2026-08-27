import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const workspace = readFileSync('src/features/notes/organicWorkspace.css', 'utf8')
const v383 = readFileSync('src/features/notes/v383WorkspaceVisual.css', 'utf8')
const guard = readFileSync('src/features/notes/organicWorkspaceTouchMotion.css', 'utf8')

test('organic tag reorder arrows keep their desktop cue without pulsing forever on touch', () => {
  assert.match(main, /import '\.\/features\/notes\/organicWorkspaceTouchMotion\.css'/)
  assert.match(workspace, /\.oanix-organic-tags__arrows[^\{]*\{[^}]*animation:\s*oanix-organic-arrows\s+1\.5s\s+ease-in-out\s+infinite/)
  assert.match(v383, /html\.oanix-v383-visual\s+\.oanix-organic-tags__arrows[^\{]*\{[^}]*animation:\s*v383-slide-arrows\s+1\.5s\s+infinite\s+ease-in-out\s*!important/)
  assert.match(guard, /@media \(pointer: coarse\)/)
  assert.match(guard, /html\.oanix-v383-visual\s+\.oanix-organic-tags__arrows,[\s\S]*\.oanix-organic-tags__arrows\s*\{[^}]*animation:\s*none\s*!important/)
})
