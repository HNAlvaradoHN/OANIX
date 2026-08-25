import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/NoteCreationFeedbackRuntime.tsx', 'utf8')

test('note creation feedback observes document detail state without a global subtree observer', () => {
  const detailObserverBlock = runtime.match(/detailObserver\.observe\(document\.documentElement, \{([\s\S]*?)\n\s*\}\)/)?.[1] ?? ''
  assert.match(detailObserverBlock, /attributes: true/)
  assert.match(detailObserverBlock, /attributeFilter: \['class'\]/)
  assert.doesNotMatch(detailObserverBlock, /subtree: true/)
})

test('note creation feedback scopes content mutations to the notes workspace', () => {
  assert.match(runtime, /document\.querySelector<HTMLElement>\('\.notes-shell'\)/)
  assert.match(runtime, /workspaceObserver\.observe\(observedWorkspace, \{\s*childList: true,\s*subtree: true,\s*characterData: true/s)
  assert.doesNotMatch(runtime, /observer\.observe\(document\.documentElement/)
  assert.doesNotMatch(runtime, /observer\.observe\(document\.body/)
})
