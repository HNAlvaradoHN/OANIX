import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const bridge = readFileSync('src/features/folders/FolderCustomizerBridgeRuntime.tsx', 'utf8')
const creation = readFileSync('src/features/folders/FolderCreationRuntime.tsx', 'utf8')
const grid = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')
const personalization = readFileSync('src/features/notes/WorkspacePersonalizationRuntime.tsx', 'utf8')
const appearance = readFileSync('src/features/folders/FolderAppearanceRuntime.tsx', 'utf8')

test('folder gear opens the unified customizer directly without the retired intermediary visual layer', () => {
  assert.match(bridge, /\.oanix-folder-card__gear/)
  assert.match(bridge, /openUnifiedFolderCustomizer/)
  assert.match(bridge, /\.oanix-folder-focus__menu/)
  assert.match(bridge, /stopImmediatePropagation/)
  assert.doesNotMatch(personalization, /oanix-folder-options-backdrop|oanix-folder-options__actions/)
  assert.equal(existsSync('src/features/folders/folderCustomizerBridge.css'), false)
  assert.equal(existsSync('src/features/notes/folderOptionsVisual.css'), false)
  assert.doesNotMatch(main, /folderOptionsVisual\.css/)
})

test('folder appearance is a draft with one explicit save action', () => {
  for (const label of [
    'Cambiar color / Icono',
    'Guardar',
    'Cambiar imagen de mi dispositivo',
    'Quitar imagen',
    'Administrar nombre / eliminar',
    'Cancelar',
  ]) {
    assert.match(appearance, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  assert.doesNotMatch(appearance, /Abrir carpeta|Restablecer color|Restablecer icono/)
  assert.match(appearance, /let draftColor =/)
  assert.match(appearance, /let draftIcon =/)
  assert.match(appearance, /void Promise\.all\(\[[\s\S]*saveFolderColor\(lastFolderId, draftColor\)[\s\S]*saveFolderIcon\(lastFolderId, draftIcon\)/)
  assert.equal((appearance.match(/saveFolderColor\(/g) ?? []).length, 1)
  assert.equal((appearance.match(/saveFolderIcon\(/g) ?? []).length, 1)
  assert.match(appearance, /resetDraftFromSaved/)
})

test('image action opens the existing local image picker directly', () => {
  assert.match(grid, /coverInputRef\.current\?\.click\(\)/)
  assert.match(grid, /type="file"/)
  assert.match(grid, /accept="image\/\*"/)
  assert.doesNotMatch(grid, /capture="camera"|capture=\{'camera'\}/)
})

test('administrar una carpeta queda aislado a esa carpeta y no abre el creador nuevo', () => {
  assert.match(bridge, /data-oanix-manage-folder-id/)
  assert.match(bridge, /\.folder-create-row/)
  assert.match(bridge, /row\.hidden = row !== target/)
  assert.match(bridge, /Administrar nombre o eliminar esta carpeta/)
  assert.match(creation, /folderManagementActive\(\)/)
  assert.match(creation, /if \(folderManagementActive\(\)\) return/)
  assert.match(creation, /createRequestedRef/)
  assert.match(creation, /\.notes-tab--add, \.oanix-folder-rail__item--add, \.oanix-organic-folder-control--add/)
})

test('folder bridge mounts before workspace personalization after unlock', () => {
  const bridgeIndex = gate.indexOf('<FolderCustomizerBridgeRuntime />')
  const personalizationIndex = gate.indexOf('<WorkspacePersonalizationRuntime />')
  assert.ok(bridgeIndex >= 0 && personalizationIndex > bridgeIndex)
})
