import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/features/rebuild/NoteListSection.tsx', 'utf8')

test('note drag autoscroll only stops at the actual directional boundary', () => {
  assert.match(source, /function reachedScrollBoundary\(container: HTMLElement, velocity: number\): boolean/)
  assert.match(source, /if \(velocity < 0\) return container\.scrollTop <= 0/)
  assert.match(source, /container\.scrollHeight - container\.clientHeight/)
  assert.match(source, /if \(reachedScrollBoundary\(container, targetVelocity\)\)/)
  assert.doesNotMatch(source, /if \(container\.scrollTop === before\)/)
})

test('note drag autoscroll keeps requesting frames while the pointer stays in an edge zone', () => {
  assert.match(source, /if \(targetVelocity === 0\)[\s\S]*return/)
  assert.match(source, /autoScrollFrameRef\.current = window\.requestAnimationFrame\(runAutoScroll\)/)
})

test('note drag target selection ignores the dragged row in either direction', () => {
  assert.match(source, /function rowAtPointExcludingDragged\(noteId: string, x: number, y: number\): HTMLElement \| null/)
  assert.match(source, /document\.elementsFromPoint\(x, y\)/)
  assert.match(source, /row\.dataset\.oanixNoteId === noteId\) continue/)
  assert.match(source, /let target = rowAtPointExcludingDragged\(noteId, x, y\)/)
  assert.doesNotMatch(source, /targetId === noteId/)
})
