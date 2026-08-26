import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const folderGrid = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')
const organic = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
const personalization = readFileSync('src/features/notes/WorkspacePersonalizationRuntime.tsx', 'utf8')

test('folder selection commits immediately and last selection wins', () => {
  assert.match(workspace, /const activeFolderIdRef = useRef<string \| 'all'>\('all'\)/)
  assert.match(workspace, /function handleSelectFolder\(folderId: string \| 'all'\)[\s\S]*?activeFolderIdRef\.current = folderId[\s\S]*?void flushPendingContent\(\)[\s\S]*?void finalizeRemovedImages\(\)[\s\S]*?setActiveFolderId\(folderId\)/)
  assert.doesNotMatch(workspace, /async function handleSelectFolder/)
  assert.match(workspace, /oanix:select-workspace-folder/)
  assert.match(workspace, /oanix:workspace-folder-committed/)
})

test('folder grid emits deterministic folder ids and reconciles committed state', () => {
  assert.match(folderGrid, /oanix:select-workspace-folder/)
  assert.match(folderGrid, /detail: \{ folderId: folder\.id \}/)
  assert.match(folderGrid, /detail: \{ folderId: 'all' \}/)
  assert.match(folderGrid, /oanix:workspace-folder-committed/)
})

test('organic background follows committed workspace state instead of dock DOM', () => {
  assert.match(organic, /oanix:workspace-folder-committed/)
  assert.doesNotMatch(organic, /selectWorkspaceFolderFromDock/)
  assert.doesNotMatch(organic, /activeFolderIdFromDock/)
  assert.doesNotMatch(organic, /textContent\?\.trim\(\) === item\.title\.trim\(\)/)
})

test('header count comes from filtered notes state instead of the folder rail DOM', () => {
  assert.match(workspace, /oanix:workspace-count-changed/)
  assert.match(workspace, /detail: \{ count: organizedNotes\.length \}/)
  assert.match(personalization, /oanix:workspace-count-changed/)
  assert.doesNotMatch(personalization, /:scope > small/)
  assert.doesNotMatch(personalization, /activeWorkspaceCount/)
})
