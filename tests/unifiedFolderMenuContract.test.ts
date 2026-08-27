import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const grid = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')
const organic = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')

test('folder customization has one direct owner', () => {
  assert.match(grid, /function openCustomizer\(folder: FolderRecord\)/)
  assert.match(grid, /oanix:open-folder-customizer/)
  assert.match(organic, /new CustomEvent\('oanix:open-folder-customizer'/)
  assert.equal(existsSync('src/features/folders/FolderCustomizerBridgeRuntime.tsx'), false)
  assert.doesNotMatch(grid + organic, /oanix-folder-focus__menu/)
})
