import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const bridge = readFileSync('src/features/folders/FolderCustomizerBridgeRuntime.tsx', 'utf8')
const personalization = readFileSync('src/features/notes/WorkspacePersonalizationRuntime.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

test('gear click never creates the retired intermediary folder menu', () => {
  assert.match(bridge, /\.oanix-folder-card__gear/)
  assert.match(bridge, /event\.preventDefault\(\)/)
  assert.match(bridge, /event\.stopPropagation\(\)/)
  assert.match(bridge, /event\.stopImmediatePropagation\(\)/)
  assert.doesNotMatch(personalization, /oanix-folder-options-backdrop|folderMenuId|setFolderMenuId/)
  assert.equal(existsSync('src/features/folders/folderCustomizerBridge.css'), false)
})

test('gear routes to the same real customizer already used by folder focus', () => {
  assert.match(bridge, /\.oanix-folder-focus\[data-oanix-folder-id=/)
  assert.match(bridge, /\.oanix-folder-focus__menu/)
  const bridgeIndex = gate.indexOf('<FolderCustomizerBridgeRuntime />')
  const personalizationIndex = gate.indexOf('<WorkspacePersonalizationRuntime />')
  assert.ok(bridgeIndex >= 0 && personalizationIndex > bridgeIndex)
})
