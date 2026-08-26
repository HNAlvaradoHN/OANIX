import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const bridge = readFileSync('src/features/folders/FolderCustomizerBridgeRuntime.tsx', 'utf8')
const creation = readFileSync('src/features/folders/FolderCreationRuntime.tsx', 'utf8')
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

test('the remaining folder customizer contains the professional action surface in its DOM flow', () => {
  for (const label of [
    'Abrir carpeta',
    'Cambiar color / Icono',
    'Cambiar imagen de mi dispositivo',
    'Quitar imagen',
    'Administrar nombre / eliminar',
    'Cancelar',
  ]) {
    assert.match(appearance, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  assert.match(appearance, /actions\.prepend\(appearanceButton\)[\s\S]*actions\.prepend\(openButton\)/)
  assert.match(appearance, /const imageButton = existingActions\[0\]/)
  assert.match(appearance, /const cancelButton = existingActions\[existingActions\.length - 1\]/)
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
