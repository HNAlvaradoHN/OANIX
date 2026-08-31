import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')
const visualRuntime = readFileSync('src/features/notes/V383WorkspaceVisualRuntime.tsx', 'utf8')

test('rebuild owns the unlocked app lifecycle while the old workspace gate stays historical', () => {
  assert.doesNotMatch(main, /WorkspaceRuntimeGate/)
  assert.match(app, /function UnlockedApp/)
  assert.match(app, /<RebuildApp onLock=\{lockVault\} \/>/)
  assert.doesNotMatch(app, /<WorkspaceRuntimeGate/)
  assert.doesNotMatch(gate, /MutationObserver/)
  assert.doesNotMatch(gate, /document\.querySelector/)
  assert.match(gate, /import\('\.\/LegacyWorkspaceRuntimeGate'\)/)
})

test('workspace-only runtime ownership keeps css and retired authorities behind the legacy boundary', () => {
  assert.doesNotMatch(legacyGate, /folderDockContract\.css/)
  assert.match(visualRuntime, /\.\/folderDockContract\.css/)
  assert.doesNotMatch(legacyGate, /FolderDockFinishingRuntime/)
  assert.doesNotMatch(legacyGate, /FolderAppearanceRuntime|FolderCustomizerBridgeRuntime/)
  assert.doesNotMatch(legacyGate, /TagCreationRuntime/)
  assert.doesNotMatch(main, /NoteMenuScrollDismiss|NoteMenuViewportFit|WorkspaceInputCompatibilityRuntime/)
})
