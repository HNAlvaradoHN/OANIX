import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/NoteCreationFeedbackRuntime.tsx', 'utf8')

test('note creation feedback observes only the sidebar surface', () => {
  assert.match(runtime, /document\.querySelector<HTMLElement>\('\.notes-sidebar'\)/)
  assert.match(runtime, /sidebarObserver\.observe\(sidebar, \{/)
  assert.doesNotMatch(runtime, /document\.querySelector<HTMLElement>\('\.notes-shell'\)/)
  assert.doesNotMatch(runtime, /workspaceObserver\.observe/)
})
