import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')

test('desktop no conserva el ghost oscuro heredado y touch usa el overlay real', () => {
  assert.match(runtime, /forceFallback: false/)
  assert.match(runtime, /fallbackOnBody: false/)
  assert.doesNotMatch(runtime, /fallbackClass: 'oanix-mobile-note-drag-ghost'/)
  assert.doesNotMatch(css, /body > \.note-row\.oanix-mobile-note-drag-ghost/)
  assert.doesNotMatch(css, /background:\s*rgba\(18,18,35,\.96\)/)
  assert.match(css, /.notes-shell > \.note-row\.oanix-mobile-note-drag-overlay\s*\{[\s\S]*overflow:\s*visible !important/)
  assert.match(css, /.notes-shell > \.note-row\.oanix-mobile-note-drag-overlay[\s\S]*background:\s*var\(--oanix-note-drag-background\) !important/)
})
