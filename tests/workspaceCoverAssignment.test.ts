import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/features/rebuild/workspaceCoverAssignmentService.ts', 'utf8')

test('new folder cover is persisted before the folder pointer changes', () => {
  const saveIndex = source.indexOf('saveWorkspaceFolderCover(file)')
  const updateIndex = source.indexOf('customizeRebuildFolder(folder, { coverAssetId: nextAssetId })')
  assert.ok(saveIndex >= 0)
  assert.ok(updateIndex > saveIndex)
})

test('failed folder pointer update cleans the newly created cover best effort', () => {
  assert.match(source, /catch \(error\)[\s\S]*deleteCoverBestEffort\(nextAssetId\)[\s\S]*throw error/)
})

test('old cover is deleted only after the new pointer is durable', () => {
  const updateIndex = source.indexOf('customizeRebuildFolder(folder, { coverAssetId: nextAssetId })')
  const cleanupIndex = source.indexOf('deleteCoverBestEffort(previousAssetId)', updateIndex)
  assert.ok(updateIndex >= 0)
  assert.ok(cleanupIndex > updateIndex)
})

test('cover removal clears the encrypted folder reference before deleting the asset', () => {
  const clearIndex = source.indexOf("customizeRebuildFolder(folder, { coverAssetId: null })")
  const cleanupIndex = source.indexOf('deleteCoverBestEffort(previousAssetId)', clearIndex)
  assert.ok(clearIndex >= 0)
  assert.ok(cleanupIndex > clearIndex)
})
