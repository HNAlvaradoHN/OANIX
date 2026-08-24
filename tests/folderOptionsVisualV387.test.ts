import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const bridge = readFileSync('src/features/folders/FolderCustomizerBridgeRuntime.tsx', 'utf8')
const bridgeCss = readFileSync('src/features/folders/folderCustomizerBridge.css', 'utf8')
const appearance = readFileSync('src/features/folders/FolderAppearanceRuntime.tsx', 'utf8')

test('folder gear opens the unified customizer directly without the retired intermediary visual layer', () => {
  assert.match(bridge, /\.oanix-folder-card__gear/)
  assert.match(bridge, /openUnifiedFolderCustomizer/)
  assert.match(bridge, /\.oanix-folder-focus__menu/)
  assert.match(bridge, /stopImmediatePropagation/)
  assert.match(bridgeCss, /\.oanix-folder-options-backdrop[\s\S]*display:\s*none !important/)
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

  // Runtime constructs the final visual order with prepend: Open is inserted last
  // so it appears first, followed by Appearance and the existing image/name actions.
  assert.match(appearance, /actions\.prepend\(appearanceButton\)[\s\S]*actions\.prepend\(openButton\)/)
  assert.match(appearance, /const imageButton = existingActions\[0\]/)
  assert.match(appearance, /const cancelButton = existingActions\[existingActions\.length - 1\]/)
})

test('folder bridge mounts before legacy personalization listeners after unlock', () => {
  const bridgeIndex = gate.indexOf('<FolderCustomizerBridgeRuntime />')
  const personalizationIndex = gate.indexOf('<WorkspacePersonalizationRuntime />')
  assert.ok(bridgeIndex >= 0 && personalizationIndex > bridgeIndex)
})
