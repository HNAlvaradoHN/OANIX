import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')
const creation = readFileSync('src/features/folders/FolderCreationRuntime.tsx', 'utf8')
const grid = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')
const personalization = readFileSync('src/features/notes/WorkspacePersonalizationRuntime.tsx', 'utf8')
const scopedManager = readFileSync('src/features/folders/FolderScopedManagerRuntime.tsx', 'utf8')

test('folder gear opens the React customizer directly', () => {
  assert.match(grid, /className="oanix-folder-card__gear"/)
  assert.match(grid, /openCustomizer\(folder\)/)
  assert.match(grid, /oanix:open-folder-customizer/)
  assert.doesNotMatch(personalization, /document\.createElement\('span'\)[\s\S]*oanix-folder-card__gear/)
  assert.equal(existsSync('src/features/folders/FolderCustomizerBridgeRuntime.tsx'), false)
})

test('folder appearance is a React draft with one explicit save', () => {
  assert.match(grid, /Cambiar color \/ Icono/)
  assert.match(grid, /customDraftColor/)
  assert.match(grid, /customDraftIcon/)
  assert.match(grid, /saveFolderColor\(folderId, color\)/)
  assert.match(grid, /saveFolderIcon\(folderId, icon\)/)
  assert.match(grid, /Cambiar imagen de mi dispositivo/)
  assert.match(grid, /Administrar nombre \/ eliminar/)
  assert.equal(existsSync('src/features/folders/FolderAppearanceRuntime.tsx'), false)
})

test('image action keeps the existing local image picker', () => {
  assert.match(grid, /coverInputRef\.current\?\.click\(\)/)
  assert.match(grid, /type="file"/)
  assert.match(grid, /accept="image\/\*"/)
  assert.doesNotMatch(grid, /capture="camera"/)
})

test('folder manager opens by explicit folder event instead of scraping DOM', () => {
  assert.match(grid, /oanix:open-folder-manager/)
  assert.match(scopedManager, /window\.addEventListener\('oanix:open-folder-manager'/)
  assert.match(scopedManager, /renameFolder/)
  assert.match(scopedManager, /deleteFolder/)
  assert.doesNotMatch(scopedManager, /oanix-folder-focus|oanix-folder-customizer__actions|stopImmediatePropagation/)
  assert.doesNotMatch(creation, /folderManagementActive|data-oanix-manage-folder-id/)
})

test('workspace gate mounts only direct folder owners', () => {
  assert.match(legacyGate, /<FolderScopedManagerRuntime \/>/)
  assert.match(legacyGate, /<WorkspacePersonalizationRuntime \/>/)
  assert.doesNotMatch(legacyGate, /FolderCustomizerBridgeRuntime|FolderAppearanceRuntime/)
})
