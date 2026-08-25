import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const reorderRuntime = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
const historyRuntime = readFileSync('src/features/versionHistory/VersionHistoryCenter.tsx', 'utf8')

test('note reorder observer stays inside the React app root', () => {
  assert.match(reorderRuntime, /const appRoot = document\.getElementById\('root'\)/)
  assert.match(reorderRuntime, /observer\.observe\(appRoot, \{ childList: true, subtree: true, attributes: true, attributeFilter: \['aria-label'\] \}\)/)
  assert.doesNotMatch(reorderRuntime, /observer\.observe\(document\.body/)
})

test('version history host observer stays inside the React app root', () => {
  assert.match(historyRuntime, /const appRoot = document\.getElementById\('root'\)/)
  assert.match(historyRuntime, /observer\.observe\(appRoot, \{ childList: true, subtree: true \}\)/)
  assert.doesNotMatch(historyRuntime, /observer\.observe\(document\.body/)
})
