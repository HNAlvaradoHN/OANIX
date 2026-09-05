import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/features/rebuild/NoteListSection.tsx', 'utf8')

test('active note drag ignores finger X while preserving native hit-testing', () => {
  assert.match(source, /function stableHitTestX\(\): number \| null/)
  assert.match(source, /return rect\.left \+ rect\.width \/ 2/)
  assert.match(source, /function rowAtPointExcludingDragged\(noteId: string, x: number, y: number\)/)
  assert.match(source, /document\.elementsFromPoint\(x, y\)/)
  assert.match(source, /const x = stableHitTestX\(\)/)
  assert.match(source, /reorderAtPoint\(noteId, event\.clientY\)/)
  assert.match(source, /reorderAtPoint\(noteId, pointer\.y\)/)
})

test('recent successful drag can be regrabbed without arming the first press accidentally', () => {
  assert.match(source, /const REGRAB_GRACE_MS = 650/)
  assert.match(source, /const lastSuccessfulDragEndRef = useRef<number \| null>\(null\)/)
  assert.match(source, /const previousDragEnd = lastSuccessfulDragEndRef\.current/)
  assert.match(source, /previousDragEnd !== null\s*&& performance\.now\(\) - previousDragEnd <= REGRAB_GRACE_MS/)
  assert.match(source, /armed: canRegrabImmediately/)
  assert.match(source, /if \(canRegrabImmediately\) \{\s*setReadyId\(noteId\)\s*\} else \{/)
  assert.match(source, /lastSuccessfulDragEndRef\.current = performance\.now\(\)/)
})
