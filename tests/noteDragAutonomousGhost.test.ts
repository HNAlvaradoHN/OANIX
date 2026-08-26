import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')

test('ghost y overlay de notas conservan una superficie visual autónoma fuera de notes-shell', () => {
  assert.match(css, /body > \.note-row\.oanix-mobile-note-drag-ghost,[\s\S]*body > \.note-row\.oanix-mobile-note-drag-overlay\s*\{[\s\S]*position:\s*fixed !important/)
  assert.match(css, /background:\s*rgba\(18,18,35,\.96\) !important/)
  assert.match(css, /border:\s*1px solid rgba\(255,255,255,\.20\) !important/)
  assert.match(css, /backdrop-filter:\s*blur\(16px\) !important/)
  assert.match(css, /-webkit-backdrop-filter:\s*blur\(16px\) !important/)
  assert.match(css, /\.note-row__topline strong[\s\S]*color:\s*#fff !important/)
  assert.match(css, /\.note-row__preview,[\s\S]*\.note-row__topline time[\s\S]*color:\s*rgba\(255,255,255,\.60\) !important/)
})
