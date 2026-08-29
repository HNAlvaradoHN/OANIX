import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/folders/FolderCreationRuntime.tsx', 'utf8')

test('folder creation no longer depends on observing the legacy dialog portal', () => {
  assert.doesNotMatch(runtime, /MutationObserver/)
  assert.doesNotMatch(runtime, /folder-dialog__panel\[aria-label="Administrar carpetas"\]/)
  assert.doesNotMatch(runtime, /syncLegacyDialog/)
  assert.doesNotMatch(runtime, /closeLegacyDialog/)
})

test('folder creation opens only through the compatibility event and persists through folderService', () => {
  assert.match(runtime, /oanix:open-folder-creator/)
  assert.doesNotMatch(runtime, /CREATE_TRIGGER_SELECTOR/)
  assert.doesNotMatch(runtime, /document\.addEventListener\('click'/)
  assert.match(runtime, /createFolder\(normalizedName\)/)
  assert.match(runtime, /saveFolderColor\(created\.id, color\)/)
  assert.match(runtime, /saveFolderIcon\(created\.id, icon\)/)
  assert.doesNotMatch(runtime, /oanix:local-data-changed/)
})
