import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')

function deleteHandlerSource() {
  const start = workspace.indexOf('async function handleDeleteNote')
  const end = workspace.indexOf('\n  function pushMobileNoteHistory', start)
  assert.ok(start >= 0 && end > start, 'delete handler must exist')
  return workspace.slice(start, end)
}

test('note deletion shows progress before waiting on encrypted saves', () => {
  const handler = deleteHandlerSource()
  const feedbackIndex = handler.indexOf('setNoteDeleteFeedback(true)')
  const flushIndex = handler.indexOf('await flushPendingContent()')

  assert.ok(feedbackIndex >= 0)
  assert.ok(flushIndex >= 0)
  assert.ok(feedbackIndex < flushIndex, 'deleting feedback must appear before pending-save work')
  assert.match(workspace, /Eliminando nota…/)
  assert.match(workspace, /Actualizando tu bóveda cifrada/)
})

test('deleting an open note returns to the list instead of selecting its neighbor', () => {
  const handler = deleteHandlerSource()

  assert.match(handler, /selectedIdRef\.current = null/)
  assert.match(handler, /setSelectedId\(null\)/)
  assert.match(handler, /oanixView: 'list'/)
  assert.doesNotMatch(handler, /nextId|nextIndex|deletedIndex/)
})

test('unrelated selected-note save work is skipped when deleting another list note', () => {
  const handler = deleteHandlerSource()
  assert.match(handler, /if \(deletingSelectedNote\) \{[\s\S]*?await flushPendingContent\(\)/)
  assert.ok(handler.indexOf('if (deletingSelectedNote)') < handler.indexOf('await flushPendingContent()'))
})

test('associated image cleanup no longer blocks the visible note removal', () => {
  const handler = deleteHandlerSource()
  const removeFromStateIndex = handler.indexOf('setNotes((current) => current.filter')
  const cleanupIndex = handler.indexOf('void Promise.all([')

  assert.ok(removeFromStateIndex >= 0)
  assert.ok(cleanupIndex > removeFromStateIndex, 'image cleanup must continue after the note leaves the UI')
})
