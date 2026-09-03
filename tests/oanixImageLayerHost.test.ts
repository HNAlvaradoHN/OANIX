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

const imageLayerSource = readFileSync(
  new URL('../src/features/editor/oanixImageLayer.ts', import.meta.url),
  'utf8',
)

test('new notes sheet routes one and many images through the new image layer boundary', () => {
  assert.match(surfaceSource, /insertImageFiles\(\[file\], cursor\)/)
  assert.match(surfaceSource, /insertMixedImageFiles\(\[file\], blockId, cursorOffset\)/)
  assert.match(surfaceSource, /multiple/)
  assert.match(surfaceSource, /Array\.from\(event\.currentTarget\.files \?\? \[\]\)/)
  assert.match(surfaceSource, /selectedFiles\.length > OANIX_IMAGE_BATCH_LIMIT/)
})

test('new image layer owns selection limit concurrency and document structure without old insertion planners', () => {
  assert.match(imageLayerSource, /OANIX_IMAGE_SELECTION_LIMIT = 5/)
  assert.match(imageLayerSource, /OANIX_IMAGE_STORE_CONCURRENCY = 2/)
  assert.doesNotMatch(imageLayerSource, /oanixImageInsertionCoordinator/)
  assert.doesNotMatch(imageLayerSource, /oanixMixedImageInsertion/)
  assert.doesNotMatch(imageLayerSource, /oanixMixedDocumentPlan/)
})

test('mixed document body still forwards the real textarea cursor and pasted image to the new host route', () => {
  assert.match(mixedBodySource, /findOanixClipboardImage\(event\.clipboardData\)/)
  assert.match(mixedBodySource, /event\.currentTarget\.selectionStart/)
  assert.match(mixedBodySource, /onPasteImage\(file, block\.id, cursorOffset\)/)
})

test('mixed insertion saves pending text and reloads confirmed blocks before the image layer commits', () => {
  assert.match(surfaceSource, /if \(dirtyRef\.current && !\(await saveCurrentSnapshot\(\)\)\)/)
  assert.match(surfaceSource, /const confirmedBlocks = await loadBlocks\(\)/)
  assert.match(surfaceSource, /blocks: confirmedBlocks/)
})
