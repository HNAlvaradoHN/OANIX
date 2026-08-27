import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/NoteCreationFeedbackRuntime.tsx', 'utf8')
const visualRuntime = readFileSync('src/features/notes/V383WorkspaceVisualRuntime.tsx', 'utf8')

test('note creation feedback consumes the visual owner detail event instead of observing root classes', () => {
  assert.doesNotMatch(runtime, /detailObserver/)
  assert.doesNotMatch(runtime, /observe\(document\.documentElement/)
  assert.match(runtime, /window\.addEventListener\('oanix:note-detail-state-changed', sync\)/)
  assert.match(runtime, /window\.removeEventListener\('oanix:note-detail-state-changed', sync\)/)
  assert.match(visualRuntime, /window\.dispatchEvent\(new CustomEvent\('oanix:note-detail-state-changed'/)
  assert.match(visualRuntime, /lastNoteDetailOpen === noteDetailOpen/)
})

test('note creation feedback ignores unrelated sidebar mutations', () => {
  assert.match(runtime, /const FEEDBACK_SURFACE_SELECTOR = `\$\{CREATE_BUTTON_SELECTOR\}, \.notes-error, \.note-save-error`/)
  assert.match(runtime, /function mutationTouchesFeedbackSurface\(record: MutationRecord\)/)
  assert.match(runtime, /record\.type === 'attributes'/)
  assert.match(runtime, /record\.target instanceof Element && record\.target\.matches\(CREATE_BUTTON_SELECTOR\)/)
  assert.match(runtime, /node\.matches\(FEEDBACK_SURFACE_SELECTOR\) \|\| node\.querySelector\(FEEDBACK_SURFACE_SELECTOR\) !== null/)
  assert.match(runtime, /records\.some\(mutationTouchesFeedbackSurface\)/)

  const sidebarObserverBlock = runtime.match(/sidebarObserver\.observe\(sidebar, \{([\s\S]*?)\n\s*\}\)/)?.[1] ?? ''
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
