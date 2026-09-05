import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const service = readFileSync('src/features/rebuild/rebuildDeletionService.ts', 'utf8')
const app = readFileSync('src/features/rebuild/RebuildApp.tsx', 'utf8')
const controller = readFileSync('src/features/rebuild/WorkspaceHomeController.tsx', 'utf8')
const dialog = readFileSync('src/features/rebuild/WorkspaceCustomizationDialog.tsx', 'utf8')

test('deleting a folder preserves notes and only rewrites affected metadata', () => {
  assert.match(service, /filter\(\(note\) => note\.folderId === folderId\)/)
  assert.match(service, /folderId: null/)
  assert.match(service, /revision: nextNoteRevision\(note\)/)
  assert.match(service, /metadataUpdateWrite\(meta, queuedAt\)/)
  assert.match(service, /recordType: FOLDER_V2_TYPE, recordId: folderId/)
  assert.match(service, /FOLDER_V2_COVER_TYPE/)
})

test('deleting a tag preserves notes and removes only that tag from affected metadata', () => {
  assert.match(service, /filter\(\(note\) => note\.tagIds\.includes\(tagId\)\)/)
  assert.match(service, /tagIds: note\.tagIds\.filter\(\(id\) => id !== tagId\)/)
  assert.match(service, /recordType: TAG_V2_TYPE, recordId: tagId/)
})

test('note deletion removes local units and replaces pending upserts with delete operations', () => {
  assert.match(service, /deleteRebuildNote\(noteId: string\)/)
  assert.match(service, /recordType: NOTE_V2_META_TYPE, recordId: noteId/)
  assert.match(service, /recordType: NOTE_V2_BODY_TYPE, recordId: noteId/)
  assert.match(service, /recordType: NOTE_V2_MANIFEST_TYPE, recordId: noteId/)
  assert.match(service, /textChunkIdentity\(noteId, chunk\.id\)/)
  assert.match(service, /'delete',[\s\S]*queuedAt/)
  assert.match(service, /applyEncryptedV2Changes\(\{ writes, deletes \}\)/)
})

test('deletion service stays behind encrypted repository boundaries', () => {
  assert.match(service, /encryptedV2RecordRepository/)
  assert.doesNotMatch(service, /localStorage|sessionStorage|indexedDB|openLocalDatabase/)
})

test('Home exposes confirmed deletion for notes, folders and tags without nested buttons', () => {
  assert.match(app, /deleteRebuildFolder/)
  assert.match(app, /deleteRebuildTag/)
  assert.match(app, /deleteRebuildNote/)
  assert.match(app, /window\.confirm\(`¿Eliminar la nota/)
  assert.match(app, /onDeleteFolder=\{removeFolder\}/)
  assert.match(app, /onDeleteTag=\{removeTag\}/)
  assert.match(controller, /onDelete=\{deleteTarget\}/)
  assert.match(dialog, /Las notas no se eliminarán; quedarán sin carpeta/)
  assert.match(dialog, /La etiqueta se quitará de las notas, pero las notas no se eliminarán/)
  assert.match(dialog, /workspace-customization__delete/)
})
