import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')

test('workspace data runtimes mount only inside the unlocked app lifecycle', () => {
  assert.doesNotMatch(main, /WorkspaceRuntimeGate/)
  assert.match(app, /function UnlockedApp/)
  assert.match(app, /<WorkspaceRuntimeGate workspaceRevision=\{workspaceRevision\} \/>/)
  assert.doesNotMatch(gate, /MutationObserver/)
  assert.doesNotMatch(gate, /document\.querySelector/)
  assert.match(gate, /import\('\.\/LegacyWorkspaceRuntimeGate'\)/)
})

test('workspace-only runtimes hydrate together once the unlocked app mounts the gate', () => {
  assert.match(legacyGate, /<OrganicWorkspaceRuntime \/>/)
  assert.match(legacyGate, /features\/notes\/folderDockContract\.css/)
  assert.doesNotMatch(legacyGate, /FolderDockFinishingRuntime/)
  assert.match(legacyGate, /<WorkspacePersonalizationRuntime \/>/)
  assert.doesNotMatch(legacyGate, /FolderAppearanceRuntime|FolderCustomizerBridgeRuntime/)
  assert.match(legacyGate, /<FolderScopedManagerRuntime \/>/)
  assert.match(legacyGate, /<FolderMobileDragRuntime \/>/)
  assert.doesNotMatch(legacyGate, /TagCreationRuntime/)
  assert.match(legacyGate, /<TagMobileGestureRuntime \/>/)
  assert.match(legacyGate, /<NoteMenuScrollDismiss \/>/)
  assert.match(legacyGate, /<NoteMenuViewportFit \/>/)
  assert.match(legacyGate, /<WorkspaceInputCompatibilityRuntime \/>/)
  assert.match(legacyGate, /<V383WorkspaceVisualRuntime \/>/)
  assert.doesNotMatch(main, /NoteMenuScrollDismiss|NoteMenuViewportFit|WorkspaceInputCompatibilityRuntime/)
})
