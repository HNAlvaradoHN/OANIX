import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')
const experience = readFileSync('src/app/workspaceExperience.ts', 'utf8')
const noteMenuViewportFit = readFileSync('src/features/notes/NoteMenuViewportFit.tsx', 'utf8')
const v383WorkspaceVisualRuntime = readFileSync('src/features/notes/V383WorkspaceVisualRuntime.tsx', 'utf8')
const noteBulkPrivacy = readFileSync('src/features/privacy/NoteBulkPrivacyRuntime.tsx', 'utf8')

test('workspace v2 has one switch and legacy visual authorities live behind a lazy boundary', () => {
  assert.match(experience, /export const WORKSPACE_V2_ENABLED = true/)
  assert.match(app, /<WorkspaceRuntimeGate workspaceRevision=\{workspaceRevision\} \/>/)
  assert.doesNotMatch(app, /NoteListReorderGestureRuntime|FolderGridRuntime/)
  assert.match(gate, /lazy\(\(\) =>[\s\S]*import\('\.\/LegacyWorkspaceRuntimeGate'\)/)
  assert.match(gate, /!WORKSPACE_V2_ENABLED && \(/)

  for (const legacy of [
    'FolderGridRuntime',
    'NoteListReorderGestureRuntime',
    'FolderMobileDragRuntime',
    'TagMobileGestureRuntime',
    'OrganicWorkspaceRuntime',
    'V383WorkspaceVisualRuntime',
    'NoteVisualIdentityRuntime',
    'WorkspaceQuickPolishRuntime',
  ]) {
    assert.ok(legacyGate.includes('<' + legacy), 'missing lazy legacy authority for ' + legacy)
    assert.ok(!gate.includes(`../features/${legacy}`), 'legacy authority is still eagerly imported: ' + legacy)
  }
})

test('legacy workspace css is not eagerly loaded when v2 is authoritative', () => {
  assert.doesNotMatch(main, /folderNavigationState\.css|note-menu-viewport-fit\.css/)
  assert.doesNotMatch(gate, /folderDockContract\.css|organicWorkspace\.css|workspacePersonalization\.css|folderMobileDrag\.css|tagMobileGesture\.css/)
  assert.match(legacyGate, /folderNavigationState\.css/)
  assert.doesNotMatch(legacyGate, /note-menu-viewport-fit\.css/)
  assert.match(legacyGate, /<NoteMenuViewportFit \/>/)
  assert.match(noteMenuViewportFit, /note-menu-viewport-fit\.css/)
  assert.doesNotMatch(legacyGate, /import ['"]\.\.\/features\/notes\/v383WorkspaceVisual\.css['"]/)
  assert.match(v383WorkspaceVisualRuntime, /import '\.\/v383WorkspaceVisual\.css'/)
  assert.match(legacyGate, /editorTrailingWorkspace\.css'[\s\S]*V383WorkspaceVisualRuntime[\s\S]*workspaceStateContract\.css'/)
  assert.match(legacyGate, /folderDockContract\.css/)
  assert.match(legacyGate, /OrganicWorkspaceRuntime/)
  assert.match(legacyGate, /WorkspacePersonalizationRuntime/)
  assert.match(legacyGate, /FolderMobileDragRuntime/)
  assert.match(legacyGate, /TagMobileGestureRuntime/)
})

test('functional editor and privacy runtimes remain outside the legacy-only block', () => {
  const beforeLegacy = gate.split('{!WORKSPACE_V2_ENABLED && (')[0]
  assert.match(beforeLegacy, /<EditorOperationRuntime \/>/)
  assert.match(beforeLegacy, /<NoteCreationFeedbackRuntime \/>/)
  assert.match(beforeLegacy, /<PrivacyStatusHelp \/>/)
  assert.doesNotMatch(gate, /noteBulkPrivacyOverrides\.css/)
  assert.match(noteBulkPrivacy, /import '\.\/noteBulkPrivacy\.css'/)
})

test('workspace v2 never inherits the legacy v38.3 prepaint class', () => {
  assert.match(main, /if \(WORKSPACE_V2_ENABLED\) \{[\s\S]*oanix-workspace-v2-active[\s\S]*\} else \{[\s\S]*oanix-v383-visual/)
  assert.match(main, /import \{ WORKSPACE_V2_ENABLED \} from '\.\/app\/workspaceExperience'/)
})
