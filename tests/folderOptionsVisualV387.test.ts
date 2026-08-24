import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const bridge = readFileSync('src/features/folders/FolderCustomizerBridgeRuntime.tsx', 'utf8')
const bridgeCss = readFileSync('src/features/folders/folderCustomizerBridge.css', 'utf8')
const appearance = readFileSync('src/features/folders/FolderAppearanceRuntime.tsx', 'utf8')

test('folder gear opens the unified customizer directly without the intermediary menu', () => {
  assert.match(bridge, /\.oanix-folder-card__gear/)
  assert.match(bridge, /openUnifiedFolderCustomizer/)
  assert.match(bridge, /\.oanix-folder-focus__menu/)
  assert.match(bridge, /stopImmediatePropagation/)
  assert.match(bridgeCss, /\.oanix-folder-options-backdrop[\s\S]*display:\s*none !important/)
  assert.doesNotMatch(main, /folderOptionsVisual\.css/)
})

test('the remaining folder customizer is the professional action surface', () => {
  const labels = [
    'Abrir carpeta',
    'Cambiar color / Icono',
    'Cambiar imagen de mi dispositivo',
    'Quitar imagen',
    'Administrar nombre / eliminar',
    'Cancelar',
  ]

  let previous = -1
  for (const label of labels) {
    const index = appearance.indexOf(label)
    assert.ok(index > previous, `${label} must stay in the unified customizer flow`)
    previous = index
  }
})

test('folder bridge mounts before legacy personalization listeners after unlock', () => {
  const bridgeIndex = gate.indexOf('<FolderCustomizerBridgeRuntime />')
  const personalizationIndex = gate.indexOf('<WorkspacePersonalizationRuntime />')
  assert.ok(bridgeIndex >= 0 && personalizationIndex > bridgeIndex)
})
