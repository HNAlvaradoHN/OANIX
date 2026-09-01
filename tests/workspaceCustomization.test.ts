import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const model = readFileSync('src/features/rebuild/rebuildModel.ts', 'utf8')
const service = readFileSync('src/features/rebuild/rebuildService.ts', 'utf8')
const customization = readFileSync('src/features/rebuild/workspaceCustomizationService.ts', 'utf8')

test('folder appearance remains part of the v2 folder record, not a visual-template store', () => {
  assert.match(model, /customColor\?: string \| null/)
  assert.match(model, /coverAssetId\?: string \| null/)
  assert.match(model, /order\?: number/)
  assert.match(model, /export function folderAccent/)
  assert.match(model, /export function folderSurfaceCss/)
  assert.doesNotMatch(customization, /localStorage|sessionStorage/)
})

test('folder and tag customization writes through encrypted v2 persistence and skips no-op changes', () => {
  assert.match(customization, /writeEncryptedV2Records/)
  assert.match(customization, /nextName === existing\.name[\s\S]*return existing/)
  assert.match(customization, /nextName === existing\.name && nextColor === existing\.color\.toLowerCase\(\)/)
  assert.match(customization, /recordType: FOLDER_V2_TYPE/)
  assert.match(customization, /recordType: TAG_V2_TYPE/)
})

test('manual folder and tag order is persisted in one encrypted batch per reorder', () => {
  assert.match(customization, /export async function reorderRebuildFolders/)
  assert.match(customization, /export async function reorderRebuildTags/)
  assert.match(customization, /if \(writes\.length > 0\) await writeEncryptedV2Records\(writes\)/)
  assert.match(customization, /arraysContainSameIds/)
})

test('workspace load honors persisted manual order while legacy records remain readable', () => {
  assert.match(service, /sortWorkspaceFolders\(folderRecords\.map/)
  assert.match(service, /sortWorkspaceTags\(tagRecords\.map/)
  assert.match(customization, /Number\.MAX_SAFE_INTEGER/)
  assert.match(service, /value\.order != null/)
})

test('folder cover contract stores only an opaque asset reference', () => {
  assert.match(customization, /normalizeCoverAssetId/)
  assert.match(customization, /coverAssetId: nextCoverAssetId/)
  assert.doesNotMatch(model, /data:image|base64/)
  assert.doesNotMatch(customization, /FileReader|readAsDataURL/)
})
