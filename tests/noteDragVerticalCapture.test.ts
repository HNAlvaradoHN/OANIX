import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/features/rebuild/NoteListSection.tsx', 'utf8')

test('active note drag follows vertical position independently of horizontal drift', () => {
  assert.match(source, /function rowAtVerticalPosition\(noteId: string, y: number\)/)
  assert.doesNotMatch(source, /document\.elementsFromPoint\(x, y\)/)
  assert.match(source, /reorderAtPoint\(noteId, event\.clientY\)/)
  assert.match(source, /reorderAtPoint\(noteId, pointer\.y\)/)
})

test('recent successful drag can be regrabbed without waiting for the long-press timer again', () => {
  assert.match(source, /const REGRAB_GRACE_MS = 650/)
  assert.match(source, /const lastSuccessfulDragEndRef = useRef\(0\)/)
  assert.match(source, /performance\.now\(\) - lastSuccessfulDragEndRef\.current <= REGRAB_GRACE_MS/)
  assert.match(source, /armed: canRegrabImmediately/)
  assert.match(source, /if \(canRegrabImmediately\) \{\s*setReadyId\(noteId\)\s*\} else \{/)
  assert.match(source, /lastSuccessfulDragEndRef\.current = performance\.now\(\)/)
})
