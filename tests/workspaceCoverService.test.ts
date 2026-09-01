import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const cover = readFileSync('src/features/rebuild/workspaceCoverService.ts', 'utf8')
const dialog = readFileSync('src/features/rebuild/WorkspaceCustomizationDialog.tsx', 'utf8')

test('workspace covers live in an encrypted v2 asset record, separate from the folder record', () => {
  assert.match(cover, /FOLDER_V2_COVER_TYPE = 'folder\.v2\.cover'/)
  assert.match(cover, /writeEncryptedV2Record/)
  assert.match(cover, /readEncryptedV2Record/)
  assert.match(cover, /deleteEncryptedV2Record/)
  assert.match(cover, /assetId/)
})

test('workspace cover preparation is bounded before persistence', () => {
  assert.match(cover, /MAX_SOURCE_BYTES = 8 \* 1024 \* 1024/)
  assert.match(cover, /MAX_COVER_EDGE = 1440/)
  assert.match(cover, /MAX_STORED_BYTES = 900 \* 1024/)
  assert.match(cover, /URL\.createObjectURL/)
  assert.match(cover, /URL\.revokeObjectURL/)
})

test('the customization surface delegates cover persistence to the application contract', () => {
  assert.match(dialog, /onChooseFolderCover/)
  assert.match(dialog, /onRemoveFolderCover/)
  assert.doesNotMatch(dialog, /writeEncrypted|localStorage|sessionStorage|FileReader|readAsDataURL/)
})
