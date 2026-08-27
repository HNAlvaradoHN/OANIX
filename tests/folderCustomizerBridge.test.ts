import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const grid = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')
const organic = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

test('folder options open the real React customizer without a click bridge', () => {
  assert.match(grid, /className="oanix-folder-card__gear"/)
  assert.match(grid, /openCustomizer\(folder\)/)
  assert.match(grid, /oanix:open-folder-customizer/)
  assert.match(organic, /oanix:open-folder-customizer/)
  assert.doesNotMatch(organic, /\.oanix-folder-focus__menu/)
  assert.equal(existsSync('src/features/folders/FolderCustomizerBridgeRuntime.tsx'), false)
  assert.doesNotMatch(gate, /FolderCustomizerBridgeRuntime/)
})

test('the retired hidden focus panel is not rendered by the folder grid', () => {
  assert.doesNotMatch(grid, /className=\{\`oanix-folder-focus/)
  assert.doesNotMatch(grid, /oanix-folder-focus__menu|oanix-folder-focus__actions|oanix-folder-focus__search/)
})
