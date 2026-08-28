import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const experience = readFileSync('src/app/workspaceExperience.ts', 'utf8')

test('workspace v2 has one switch that excludes legacy drag and folder-grid authorities', () => {
  assert.match(experience, /export const WORKSPACE_V2_ENABLED = false/)
  assert.match(app, /!WORKSPACE_V2_ENABLED && <NoteListReorderGestureRuntime/)
  assert.match(app, /!WORKSPACE_V2_ENABLED && <FolderGridRuntime \/>/)
  assert.match(gate, /!WORKSPACE_V2_ENABLED && \(/)

  for (const legacy of [
    'FolderMobileDragRuntime',
    'TagMobileGestureRuntime',
    'OrganicWorkspaceRuntime',
    'V383WorkspaceVisualRuntime',
    'NoteVisualIdentityRuntime',
    'WorkspaceQuickPolishRuntime',
  ]) {
    assert.ok(gate.includes('<' + legacy + ' />'), 'missing legacy gate for ' + legacy)
  }
})

test('functional editor and privacy runtimes remain outside the legacy-only block', () => {
  const beforeLegacy = gate.split('{!WORKSPACE_V2_ENABLED && (')[0]
  assert.match(beforeLegacy, /<EditorOperationRuntime \/>/)
  assert.match(beforeLegacy, /<NoteCreationFeedbackRuntime \/>/)
  assert.match(beforeLegacy, /<PrivacyStatusHelp \/>/)
})


test('workspace v2 never inherits the legacy v38.3 prepaint class', () => {
  assert.match(main, /if \(WORKSPACE_V2_ENABLED\) \{[\s\S]*oanix-workspace-v2-active[\s\S]*\} else \{[\s\S]*oanix-v383-visual/)
  assert.match(main, /import \{ WORKSPACE_V2_ENABLED \} from '\.\/app\/workspaceExperience'/)
})
