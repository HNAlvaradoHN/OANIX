import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const bridge = readFileSync('src/features/folders/FolderCustomizerBridgeRuntime.tsx', 'utf8')
const css = readFileSync('src/features/folders/folderCustomizerBridge.css', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

test('gear click never exposes the old intermediary folder menu', () => {
  assert.match(bridge, /\.oanix-folder-card__gear/)
  assert.match(bridge, /event\.preventDefault\(\)/)
  assert.match(bridge, /event\.stopPropagation\(\)/)
  assert.match(bridge, /event\.stopImmediatePropagation\(\)/)
  assert.match(css, /\.oanix-folder-options-backdrop[\s\S]*display:\s*none !important/)
})

test('gear routes to the same real customizer already used by folder focus', () => {
  assert.match(bridge, /\.oanix-folder-focus\[data-oanix-folder-id=/)
  assert.match(bridge, /\.oanix-folder-focus__menu/)
  const bridgeIndex = gate.indexOf('<FolderCustomizerBridgeRuntime />')
  const legacyIndex = gate.indexOf('<WorkspacePersonalizationRuntime />')
  assert.ok(bridgeIndex >= 0 && legacyIndex > bridgeIndex)
})
