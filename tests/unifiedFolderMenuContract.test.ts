import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const bridge = readFileSync('src/features/folders/FolderCustomizerBridgeRuntime.tsx', 'utf8')
const personalization = readFileSync('src/features/notes/WorkspacePersonalizationRuntime.tsx', 'utf8')

test('obsolete intermediary folder options layer is absent instead of hidden', () => {
  assert.doesNotMatch(main, /folderOptionsVisual\.css/)
  assert.equal(existsSync('src/features/folders/folderCustomizerBridge.css'), false)
  assert.doesNotMatch(personalization, /oanix-folder-options-backdrop|oanix-folder-options__actions/)
})

test('folder gear routes to the real customizer used by folder focus', () => {
  assert.match(bridge, /openUnifiedFolderCustomizer/)
  assert.match(bridge, /\.oanix-folder-focus__menu/)
})
