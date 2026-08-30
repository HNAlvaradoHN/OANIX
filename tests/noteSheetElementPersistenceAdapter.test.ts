import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const adapter = readFileSync('src/features/notes/noteSheetElementPersistenceAdapter.ts', 'utf8')
const blockControls = readFileSync('src/features/notes/themes/aurora/AuroraBlockControls.tsx', 'utf8')
const imageEditor = readFileSync('src/features/images/ImageNoteEditor.tsx', 'utf8')

test('confirmed note-sheet atomic deletion is authorized before persistence reconciliation', () => {
  assert.match(blockControls, /persistConfirmedAtomicElementRemoval/)
  assert.match(adapter, /editor\.dataset\.oanixAuthorizedProtectedRemoval = blockId/)
  assert.match(adapter, /block\.remove\(\)/)
  assert.match(adapter, /dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/)

  const authorization = adapter.indexOf('editor.dataset.oanixAuthorizedProtectedRemoval = blockId')
  const removal = adapter.indexOf('block.remove()')
  const persistedInput = adapter.indexOf("dispatchEvent(new Event('input', { bubbles: true }))")
  assert.ok(authorization >= 0 && authorization < removal)
  assert.ok(removal >= 0 && removal < persistedInput)

  assert.match(imageEditor, /editor\?\.dataset\.oanixAuthorizedProtectedRemoval/)
  assert.match(imageEditor, /allowedRemovedIds\.add\(domAuthorizedRemoval\)/)
  assert.match(imageEditor, /delete editor\.dataset\.oanixAuthorizedProtectedRemoval/)
})
