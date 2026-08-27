import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')

test('ghost conserva fallback autónomo y overlay mantiene la apariencia real de la nota', () => {
  assert.match(css, /body > \.note-row\.oanix-mobile-note-drag-ghost\s*\{[\s\S]*position:\s*fixed !important/)
  assert.match(css, /body > \.note-row\.oanix-mobile-note-drag-ghost\s*\{[\s\S]*background:\s*rgba\(18,18,35,\.96\) !important/)
  assert.match(css, /body > \.note-row\.oanix-mobile-note-drag-overlay\s*\{[\s\S]*overflow:\s*visible !important/)
  assert.match(css, /body > \.note-row\.oanix-mobile-note-drag-overlay[\s\S]*background:\s*var\(--oanix-note-drag-background\) !important/)
  assert.doesNotMatch(css, /body > \.note-row\.oanix-mobile-note-drag-ghost,[\s\S]*body > \.note-row\.oanix-mobile-note-drag-overlay\s*\{[\s\S]*background:\s*rgba\(18,18,35,\.96\) !important/)
})
