import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sheetSource = await readFile(
  new URL('../src/features/editor/implementations/OanixNotesSheetSurface.tsx', import.meta.url),
  'utf8',
)

test('image command parity uses the same batch insertion path for picker and paste', () => {
  assert.equal(sheetSource.includes('async function insertImageFiles(files: readonly File[])'), true)
  assert.equal(sheetSource.includes('void insertImageFiles(selectedFiles)'), true)
  assert.equal(sheetSource.includes('void insertImageFiles([file])'), true)
  assert.equal(sheetSource.includes('insertOanixImageBatch({'), true)
  assert.equal(sheetSource.includes('storeAttachment: storeAttachmentFile'), true)
  assert.equal(sheetSource.includes('saveBlockChanges: applyBlockChanges'), true)
  assert.equal(sheetSource.includes('removeAttachment: removeAttachmentFile'), true)
})
