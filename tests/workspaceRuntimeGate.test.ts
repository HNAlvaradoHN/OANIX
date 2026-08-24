import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

test('workspace data runtimes mount only inside the unlocked app lifecycle', () => {
  assert.doesNotMatch(main, /WorkspaceRuntimeGate/)
  assert.match(app, /function UnlockedApp/)
  assert.match(app, /<WorkspaceRuntimeGate \/>/)
  assert.doesNotMatch(gate, /MutationObserver/)
  assert.doesNotMatch(gate, /document\.querySelector/)
})

test('workspace-only runtimes hydrate together once the unlocked app mounts the gate', () => {
  assert.match(gate, /<OrganicWorkspaceRuntime \/>/)
  assert.match(gate, /features\/notes\/folderDockContract\.css/)
  assert.doesNotMatch(gate, /FolderDockFinishingRuntime/)
  assert.match(gate, /<WorkspacePersonalizationRuntime \/>/)
  assert.match(gate, /<FolderAppearanceRuntime \/>/)
  assert.match(gate, /<FolderMobileDragRuntime \/>/)
  assert.match(gate, /<TagCreationRuntime \/>/)
  assert.match(gate, /<V383WorkspaceVisualRuntime \/>/)
})
