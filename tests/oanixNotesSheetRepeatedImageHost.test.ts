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

test('notes sheet wires repeated image insertion through the batch coordinator', () => {
  assert.match(surfaceSource, /insertOanixImageBatch/)
  assert.match(surfaceSource, /if \(dirtyRef\.current && !\(await saveCurrentSnapshot\(\)\)\)/)
  assert.match(surfaceSource, /const confirmedBlocks = await loadBlocks\(\)/)
  assert.match(surfaceSource, /blocks: confirmedBlocks/)
  assert.match(surfaceSource, /onTextCursorChange=\{rememberMixedCursor\}/)
  assert.match(surfaceSource, /onPasteImage=\{\(file, blockId, cursorOffset\) => \{[\s\S]*void insertMixedImageFiles\(\[file\], blockId, cursorOffset\)[\s\S]*\}\}/)
})

test('mixed image paste stays native and carries the exact textarea cursor to the host', () => {
  assert.match(mixedBodySource, /findOanixClipboardImage\(event\.clipboardData\)/)
  assert.match(mixedBodySource, /event\.currentTarget\.selectionStart/)
  assert.match(mixedBodySource, /onPasteImage\(file, block\.id, cursorOffset\)/)
})

test('image picker retains target and sends the selected ordered batch to one insertion command', () => {
  assert.match(surfaceSource, /rememberMixedCursorFromActiveElement\(\)/)
  assert.match(surfaceSource, /pendingMixedImageTargetRef\.current/)
  assert.match(surfaceSource, /multiple/)
  assert.match(surfaceSource, /Array\.from\(event\.currentTarget\.files \?\? \[\]\)/)
  assert.match(surfaceSource, /selectedFiles\.length > OANIX_IMAGE_BATCH_LIMIT/)
  assert.match(surfaceSource, /if \(mixedTarget\) void insertMixedImageFiles\(selectedFiles, mixedTarget\.blockId, mixedTarget\.cursorOffset\)/)
})
