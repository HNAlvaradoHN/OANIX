import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/folders/FolderCreationRuntime.tsx', 'utf8')

test('folder creation only watches direct body children for the legacy portal', () => {
  assert.match(runtime, /observer\.observe\(document\.body, \{ childList: true \}\)/)
  assert.doesNotMatch(runtime, /observer\.observe\(document\.body, \{ childList: true, subtree: true \}\)/)
})

test('folder creation keeps the legacy dialog bridge intact', () => {
  assert.match(runtime, /folder-dialog__panel\[aria-label="Administrar carpetas"\]/)
  assert.match(runtime, /syncLegacyDialog\(\)/)
  assert.match(runtime, /closeLegacyDialog\(\)/)
})
