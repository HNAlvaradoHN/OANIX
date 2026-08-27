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

test('note creation feedback ignores unrelated sidebar mutations', () => {
  assert.match(runtime, /const FEEDBACK_SURFACE_SELECTOR = `\$\{CREATE_BUTTON_SELECTOR\}, \.notes-error, \.note-save-error`/)
  assert.match(runtime, /function mutationTouchesFeedbackSurface\(record: MutationRecord\)/)
  assert.match(runtime, /record\.type === 'attributes'/)
  assert.match(runtime, /record\.target instanceof Element && record\.target\.matches\(CREATE_BUTTON_SELECTOR\)/)
  assert.match(runtime, /node\.matches\(FEEDBACK_SURFACE_SELECTOR\) \|\| node\.querySelector\(FEEDBACK_SURFACE_SELECTOR\) !== null/)
  assert.match(runtime, /records\.some\(mutationTouchesFeedbackSurface\)/)

  const sidebarObserverBlock = runtime.match(/sidebarObserver\.observe\(observedSidebar, \{([\s\S]*?)\n\s*\}\)/)?.[1] ?? ''
  assert.match(sidebarObserverBlock, /childList: true/)
  assert.match(sidebarObserverBlock, /subtree: true/)
  assert.match(sidebarObserverBlock, /attributes: true/)
  assert.match(sidebarObserverBlock, /attributeFilter: \['disabled'\]/)
  assert.doesNotMatch(sidebarObserverBlock, /characterData: true/)
  assert.doesNotMatch(sidebarObserverBlock, /aria-label/)
  assert.doesNotMatch(runtime, /observer\.observe\(document\.documentElement/)
  assert.doesNotMatch(runtime, /observer\.observe\(document\.body/)
  assert.doesNotMatch(runtime, /workspaceObserver\.observe/)
})
