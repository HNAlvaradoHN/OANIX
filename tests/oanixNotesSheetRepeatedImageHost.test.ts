import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const surfaceSource = readFileSync(
  new URL('../src/features/editor/implementations/OanixNotesSheetSurface.tsx', import.meta.url),
  'utf8',
)

const mixedBodySource = readFileSync(
  new URL('../src/features/editor/implementations/OanixMixedDocumentBody.tsx', import.meta.url),
  'utf8',
)

test('notes sheet wires repeated image insertion through the mixed-document coordinator', () => {
  assert.match(surfaceSource, /insertOanixImageIntoMixedDocument/)
  assert.match(surfaceSource, /if \(dirtyRef\.current && !\(await saveCurrentSnapshot\(\)\)\)/)
  assert.match(surfaceSource, /const confirmedBlocks = await loadBlocks\(\)/)
  assert.match(surfaceSource, /blocks: confirmedBlocks/)
  assert.match(surfaceSource, /onTextCursorChange=\{rememberMixedCursor\}/)
  assert.match(surfaceSource, /onPasteImage=\{\(file, blockId, cursorOffset\) => void insertMixedImageFile\(file, blockId, cursorOffset\)\}/)
})

test('mixed image paste stays native and carries the exact textarea cursor to the host', () => {
  assert.match(mixedBodySource, /findOanixClipboardImage\(event\.clipboardData\)/)
  assert.match(mixedBodySource, /event\.currentTarget\.selectionStart/)
  assert.match(mixedBodySource, /onPasteImage\(file, block\.id, cursorOffset\)/)
})

test('image picker can retain a mixed text target after the keyboard is closed', () => {
  assert.match(surfaceSource, /rememberMixedCursorFromActiveElement\(\)/)
  assert.match(surfaceSource, /pendingMixedImageTargetRef\.current/)
  assert.match(surfaceSource, /if \(mixedTarget\) void insertMixedImageFile\(file, mixedTarget\.blockId, mixedTarget\.cursorOffset\)/)
})
