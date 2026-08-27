import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')
const v383 = readFileSync('src/features/notes/v383WorkspaceVisual.css', 'utf8')

test('touch notes neutralize latched hover transform including v383 specificity', () => {
  const coarseStart = css.indexOf('@media (pointer: coarse)')
  const coarseEnd = css.indexOf('.note-row.oanix-mobile-note-chosen', coarseStart)
  assert.ok(coarseStart >= 0 && coarseEnd > coarseStart)
  const coarse = css.slice(coarseStart, coarseEnd)

  assert.match(v383, /html\.oanix-v383-visual \.note-row:hover\s*\{[^}]*transform:\s*translateY\(-2px\)\s*!important;/)
  assert.match(coarse, /\.note-row:hover,\s*html\.oanix-v383-visual \.note-row:hover\s*\{[^}]*transform:\s*none\s*!important;/)
})
