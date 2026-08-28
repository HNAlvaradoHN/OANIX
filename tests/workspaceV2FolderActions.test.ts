import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const actions = readFileSync('src/features/notes/WorkspaceV2FolderActions.tsx', 'utf8')
const sidebar = readFileSync('src/features/notes/WorkspaceV2Sidebar.tsx', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')

test('workspace v2 folder menu reuses encrypted appearance and cover services', () => {
  for (const required of [
    'saveFolderPinned',
    'saveFolderFavorite',
    'saveFolderColor',
    'saveFolderIcon',
    'prepareFolderCover',
    'saveFolderCover',
    'removeFolderCover',
  ]) {
    assert.ok(actions.includes(required), `missing ${required}`)
  }
  assert.doesNotMatch(actions, /localStorage|sessionStorage|URL\.createObjectURL/)
})

test('workspace v2 folder menu owns rename/delete UI but delegates data-safe mutations', () => {
  assert.match(actions, /await onRename\(folder, normalized\)/)
  assert.match(actions, /await onDelete\(folder\)/)
  assert.match(sidebar, /onRename=\{onRenameFolder\}/)
  assert.match(sidebar, /onDelete=\{onDeleteFolder\}/)
  assert.match(workspace, /onRenameFolder=\{handleV2RenameFolder\}/)
  assert.match(workspace, /onDeleteFolder=\{handleDeleteFolder\}/)
})

test('folder drag target and options button are separate controls', () => {
  assert.match(sidebar, /data-v2-drag-kind="folder"[\s\S]*className="oanix-workspace-v2__folder-main"/)
  assert.match(sidebar, /className="oanix-workspace-v2__folder-gear"[\s\S]*data-v2-drag-ignore="true"/)
})

test('workspace v2 folder menu does not reintroduce the redundant open-folder action', () => {
  assert.doesNotMatch(actions, /Abrir carpeta/)
  assert.doesNotMatch(actions, /onOpen/)
})
