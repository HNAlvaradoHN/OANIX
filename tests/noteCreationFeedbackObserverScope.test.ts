import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/NoteCreationFeedbackRuntime.tsx', 'utf8')

test('note creation feedback observes document detail state without a global subtree observer', () => {
  assert.match(runtime, /detailObserver\.observe\(document\.documentElement, \{\s*attributes: true,\s*attributeFilter: \['class'\]/s)
  assert.doesNotMatch(runtime, /detailObserver\.observe\(document\.documentElement, \{[\s\S]*subtree: true/)
})

test('note creation feedback scopes content mutations to the notes workspace', () => {
  assert.match(runtime, /document\.querySelector<HTMLElement>\('\.notes-shell'\)/)
  assert.match(runtime, /workspaceObserver\?\.observe\(workspace, \{\s*childList: true,\s*subtree: true,\s*characterData: true/s)
  assert.doesNotMatch(runtime, /observer\.observe\(document\.documentElement/)
  assert.doesNotMatch(runtime, /observer\.observe\(document\.body/)
})
