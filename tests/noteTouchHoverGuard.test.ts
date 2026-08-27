import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')

test('touch notes neutralize latched hover transform without touching desktop hover', () => {
  const coarseStart = css.indexOf('@media (pointer: coarse)')
  const coarseEnd = css.indexOf('.note-row.oanix-mobile-note-chosen', coarseStart)
  assert.ok(coarseStart >= 0 && coarseEnd > coarseStart)
  const coarse = css.slice(coarseStart, coarseEnd)
  assert.match(coarse, /\.note-row:hover\s*\{[\s\S]*transform:\s*none !important;/)
})
