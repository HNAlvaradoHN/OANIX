import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

test('workspace data runtimes are not mounted while the vault screen is visible', () => {
  assert.match(main, /<WorkspaceRuntimeGate \/>/)
  assert.doesNotMatch(main, /<OrganicWorkspaceRuntime \/>/)
  assert.doesNotMatch(main, /<WorkspacePersonalizationRuntime \/>/)
  assert.doesNotMatch(main, /<FolderAppearanceRuntime \/>/)
  assert.match(gate, /document\.querySelector\('\.notes-sidebar'\) !== null/)
  assert.match(gate, /if \(!active\) return null/)
})

test('all workspace-only runtimes hydrate together after notes-sidebar exists', () => {
  assert.match(gate, /<OrganicWorkspaceRuntime \/>/)
  assert.match(gate, /<FolderDockFinishingRuntime \/>/)
  assert.match(gate, /<WorkspacePersonalizationRuntime \/>/)
  assert.match(gate, /<FolderAppearanceRuntime \/>/)
  assert.match(gate, /<FolderMobileDragRuntime \/>/)
  assert.match(gate, /<TagCreationRuntime \/>/)
  assert.match(gate, /<V383WorkspaceVisualRuntime \/>/)
})
