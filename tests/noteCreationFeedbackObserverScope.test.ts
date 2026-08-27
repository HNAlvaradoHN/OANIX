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

test('note creation feedback scopes workspace mutations to structural changes and disabled create-state changes', () => {
  assert.match(runtime, /document\.querySelector<HTMLElement>\('\.notes-shell'\)/)
  const workspaceObserverBlock = runtime.match(/workspaceObserver\.observe\(observedWorkspace, \{([\s\S]*?)\n\s*\}\)/)?.[1] ?? ''
  assert.match(workspaceObserverBlock, /childList: true/)
  assert.match(workspaceObserverBlock, /subtree: true/)
  assert.match(workspaceObserverBlock, /attributes: true/)
  assert.match(workspaceObserverBlock, /attributeFilter: \['disabled'\]/)
  assert.doesNotMatch(workspaceObserverBlock, /characterData: true/)
  assert.doesNotMatch(workspaceObserverBlock, /aria-label/)
  assert.doesNotMatch(runtime, /observer\.observe\(document\.documentElement/)
  assert.doesNotMatch(runtime, /observer\.observe\(document\.body/)
})
