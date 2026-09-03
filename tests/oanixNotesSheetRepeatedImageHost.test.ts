import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const surfaceSource = readFileSync(new URL('../src/features/editor/implementations/OanixNotesSheetSurface.tsx', import.meta.url), 'utf8')
const mixedBodySource = readFileSync(new URL('../src/features/editor/implementations/OanixMixedDocumentBody.tsx', import.meta.url), 'utf8')

test('notes sheet wires repeated image insertion through the batch coordinator', () => {
  assert.equal(surfaceSource.includes('insertOanixImageBatch'), true)
  assert.equal(surfaceSource.includes('if (dirtyRef.current && !(await saveCurrentSnapshot()))'), true)
  assert.equal(surfaceSource.includes('const confirmedBlocks = await loadBlocks()'), true)
  assert.equal(surfaceSource.includes('blocks: confirmedBlocks'), true)
  assert.equal(surfaceSource.includes('onTextCursorChange={rememberMixedCursor}'), true)
  assert.equal(surfaceSource.includes('insertMixedImageFiles([file], blockId, cursorOffset)'), true)
})

test('mixed image paste stays native and carries the exact textarea cursor to the host', () => {
  assert.equal(mixedBodySource.includes('findOanixClipboardImage(event.clipboardData)'), true)
  assert.equal(mixedBodySource.includes('event.currentTarget.selectionStart'), true)
  assert.equal(mixedBodySource.includes('onPasteImage(file, block.id, cursorOffset)'), true)
})

test('image picker retains target and sends the selected ordered batch to one insertion command', () => {
  assert.equal(surfaceSource.includes('rememberMixedCursorFromActiveElement()'), true)
  assert.equal(surfaceSource.includes('pendingMixedImageTargetRef.current'), true)
  assert.equal(surfaceSource.includes('multiple'), true)
  assert.equal(surfaceSource.includes('Array.from(event.currentTarget.files ?? [])'), true)
  assert.equal(surfaceSource.includes('selectedFiles.length > OANIX_IMAGE_BATCH_LIMIT'), true)
  assert.equal(surfaceSource.includes('insertMixedImageFiles(selectedFiles, mixedTarget.blockId, mixedTarget.cursorOffset)'), true)
})
