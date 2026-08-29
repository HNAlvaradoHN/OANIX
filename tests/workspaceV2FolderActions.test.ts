import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const actions = readFileSync('src/features/notes/WorkspaceV2FolderActions.tsx', 'utf8')
const sidebar = readFileSync('src/features/notes/WorkspaceV2Sidebar.tsx', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const creator = readFileSync('src/features/notes/WorkspaceV2FolderCreator.tsx', 'utf8')
const encryptedRecords = readFileSync('src/storage/repositories/encryptedRecordRepository.ts', 'utf8')

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

test('workspace v2 folder actions leave local-data-changed ownership to the encrypted repository', () => {
  assert.doesNotMatch(actions, /oanix:local-data-changed/)
  assert.match(encryptedRecords, /function notifyLocalEncryptedChange/)
  assert.match(encryptedRecords, /oanix:local-data-changed/)
  assert.match(encryptedRecords, /if \(notify\) notifyLocalEncryptedChange\(recordType, recordId\)/)
  assert.match(encryptedRecords, /notifyLocalEncryptedChange\(recordType, recordId\)/)
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


test('successful folder appearance actions close the focused menu instead of leaving stale UI open', () => {
  assert.match(actions, /saveAppearance\(\)[\s\S]*saveFolderColor[\s\S]*onClose\(\)/)
  assert.match(actions, /togglePinned\(\)[\s\S]*saveFolderPinned[\s\S]*onClose\(\)/)
  assert.match(actions, /toggleFavorite\(\)[\s\S]*saveFolderFavorite[\s\S]*onClose\(\)/)
  assert.match(actions, /applyCover\(file: File \| null\)[\s\S]*saveFolderCover[\s\S]*onClose\(\)/)
})


test('workspace v2 add-folder control opens the focused creator instead of the legacy manager', () => {
  assert.match(sidebar, /setFolderCreatorOpen\(true\)/)
  assert.match(sidebar, /<WorkspaceV2FolderCreator/)
  assert.match(sidebar, /onCreate=\{onCreateFolder\}/)
  assert.match(creator, /aria-label="Nueva carpeta"/)
  assert.match(creator, /FOLDER_COLOR_PRESETS/)
  assert.match(creator, /FOLDER_ICON_OPTIONS/)
  assert.match(workspace, /onCreateFolder=\{handleV2CreateFolder\}/)
  assert.match(workspace, /saveFolderColor\(folder\.id, appearance\.color\)/)
  assert.match(workspace, /saveFolderIcon\(folder\.id, appearance\.icon\)/)
  assert.match(workspace, /!WORKSPACE_V2_ENABLED && \(/)
})
