import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const reorderRuntime = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
const historyRuntime = readFileSync('src/features/versionHistory/VersionHistoryCenter.tsx', 'utf8')

test('note reorder stays scoped to the notes list without a global DOM observer', () => {
  assert.match(reorderRuntime, /list\?\.classList\.contains\('notes-list'\)/)
  assert.match(reorderRuntime, /:scope > \.note-row\[data-reorder-note-id\]/)
  assert.doesNotMatch(reorderRuntime, /new MutationObserver/)
  assert.doesNotMatch(reorderRuntime, /observer\.observe\(document\.body/)
})

test('version history host observer filters unrelated app mutations', () => {
  assert.match(historyRuntime, /const VERSION_HISTORY_HOST_SELECTOR = '\.notes-header__actions'/)
  assert.match(historyRuntime, /const appRoot = document\.getElementById\('root'\)/)
  assert.match(historyRuntime, /new MutationObserver\(\(records\) =>/)
  assert.match(historyRuntime, /records\.some\(mutationTouchesVersionHistoryHost\)/)
  assert.match(historyRuntime, /observer\.observe\(appRoot, \{ childList: true, subtree: true \}\)/)
  assert.doesNotMatch(historyRuntime, /new MutationObserver\(refreshHost\)/)
  assert.doesNotMatch(historyRuntime, /observer\.observe\(document\.body/)
})
