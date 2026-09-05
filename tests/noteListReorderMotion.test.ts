import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/features/rebuild/NoteListSection.tsx', 'utf8')

test('note reorder captures visible positions before changing drag order', () => {
  assert.match(source, /const rowElementsRef = useRef\(new Map<string, HTMLElement>\(\)\)/)
  assert.match(source, /function captureRowPositions\(\)/)
  assert.match(source, /positions\.set\(noteId, row\.getBoundingClientRect\(\)\.top\)/)
  assert.match(source, /captureRowPositions\(\)\s*\n\s*cancelRowAnimations\(\)/)
})

test('note reorder uses a short interruptible FLIP animation instead of delaying pointer input', () => {
  assert.match(source, /const REORDER_ANIMATION_MS = 120/)
  assert.match(source, /useLayoutEffect\(\(\) =>/)
  assert.match(source, /previousTop - row\.getBoundingClientRect\(\)\.top/)
  assert.match(source, /row\.animate\(/)
  assert.match(source, /translateY\(\$\{deltaY\}px\) scale\(\$\{scale\}\)/)
  assert.match(source, /cubic-bezier\(\.2,\.8,\.2,1\)/)
  assert.match(source, /prefers-reduced-motion: reduce/)
})
