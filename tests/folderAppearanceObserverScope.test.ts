import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const grid = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

test('folder appearance no longer needs an observer runtime', () => {
  assert.equal(existsSync('src/features/folders/FolderAppearanceRuntime.tsx'), false)
  assert.doesNotMatch(gate, /FolderAppearanceRuntime/)
  assert.match(grid, /loadFolderIcons/)
  assert.match(grid, /saveFolderColor/)
  assert.match(grid, /saveFolderIcon/)
  assert.doesNotMatch(grid, /document\.createElement\('button'\)/)
})

test('folder appearance persistence owns generic refresh while legacy feedback remains explicit', () => {
  const start = grid.indexOf('async function handleSaveAppearance')
  const end = grid.indexOf('function openScopedManager', start)
  assert.ok(start >= 0)
  assert.ok(end > start)
  const saveAppearance = grid.slice(start, end)

  assert.match(saveAppearance, /saveFolderColor/)
  assert.match(saveAppearance, /saveFolderIcon/)
  assert.match(saveAppearance, /oanix:folder-appearance-saved/)
  assert.doesNotMatch(saveAppearance, /oanix:local-data-changed/)
})
