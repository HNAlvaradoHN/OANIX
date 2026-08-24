import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const bridge = readFileSync('src/features/folders/FolderCustomizerBridgeRuntime.tsx', 'utf8')
const css = readFileSync('src/features/folders/folderCustomizerBridge.css', 'utf8')

test('obsolete intermediary folder options layer is not loaded or shown', () => {
  assert.doesNotMatch(main, /folderOptionsVisual\.css/)
  assert.match(css, /oanix-folder-options-backdrop[\s\S]*display:\s*none !important/)
})

test('folder gear routes to the real customizer used by folder focus', () => {
  assert.match(bridge, /openUnifiedFolderCustomizer/)
  assert.match(bridge, /\.oanix-folder-focus__menu/)
})
