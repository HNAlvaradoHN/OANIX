import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const notesWorkspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const folderCreationCss = readFileSync('src/features/folders/folderCreation.css', 'utf8')
const folderCreation = readFileSync('src/features/folders/FolderCreationRuntime.tsx', 'utf8')
const tagCreation = readFileSync('src/features/tags/TagCreationRuntime.tsx', 'utf8')
const noteService = readFileSync('src/features/notes/noteService.ts', 'utf8')
const organic = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
const personalization = readFileSync('src/features/notes/WorkspacePersonalizationRuntime.tsx', 'utf8')

test('note tag and folder actions keep their real encrypted handlers and visible dialogs', () => {
  assert.match(notesWorkspace, /function openTagEditor\(note: NoteRecord\)/)
  assert.match(notesWorkspace, /handleSaveNoteTags/)
  assert.match(notesWorkspace, /setNoteTags\(tagEditorNote\.id, validIds\)/)
  assert.match(notesWorkspace, /setMoveNoteId\(note\.id\)/)
  assert.match(notesWorkspace, /moveNoteToFolder\(targetNote\.id, folderId\)/)
  assert.match(notesWorkspace, /aria-label="Etiquetas de la nota"/)
  assert.match(notesWorkspace, /aria-label="Mover nota a carpeta"/)

  assert.match(folderCreationCss, /folder-dialog:has\(\.folder-dialog__panel\[aria-label="Administrar carpetas"\]\)/)
  assert.match(folderCreationCss, /folder-dialog__panel\[aria-label="Etiquetas de la nota"\]/)
  assert.match(folderCreationCss, /folder-dialog__panel\[aria-label="Mover nota a carpeta"\]/)
  assert.match(folderCreationCss, /z-index:\s*6200 !important/)
  assert.match(folderCreationCss, /border-radius:\s*26px !important/)
  assert.doesNotMatch(
    folderCreationCss,
    /html\.oanix-folder-create-v2 \.folder-dialog,\s*body\.oanix-folder-create-v2 \.folder-dialog\s*\{\s*display:\s*none !important;/,
  )
})

test('single note changes refresh visual runtimes without decrypting the whole note list again', () => {
  assert.match(noteService, /export function loadNote\(noteId: string\): Promise<NoteRecord \| null>/)
  assert.match(noteService, /return readNote\(noteId\)/)

  assert.match(organic, /PRIVATE_UI_RELOAD_DEBOUNCE_MS = 48/)
  assert.match(organic, /async function refreshChangedNote\(noteId: string\)/)
  assert.match(organic, /detail\?\.recordType === 'note'/)
  assert.match(organic, /void refreshChangedNote\(detail\.recordId\)/)
  assert.match(organic, /ensureHost\(\)\s*\n\s*void reloadPrivateUiData\(\)/)

  assert.match(personalization, /PERSONALIZATION_RELOAD_DEBOUNCE_MS = 48/)
  assert.match(personalization, /async function refreshChangedNote\(noteId: string\)/)
  assert.match(personalization, /detail\?\.recordType === 'note'/)
  assert.match(personalization, /void refreshChangedNote\(detail\.recordId\)/)
})

test('visual runtimes do not emit duplicate generic change events after encrypted writes', () => {
  const duplicateGenericEvent = /window\.dispatchEvent\(new Event\('oanix:local-data-changed'\)\)/
  assert.doesNotMatch(folderCreation, duplicateGenericEvent)
  assert.doesNotMatch(tagCreation, duplicateGenericEvent)
  assert.doesNotMatch(personalization, duplicateGenericEvent)

  assert.match(tagCreation, /detail\.recordType !== 'tag'/)
  assert.match(tagCreation, /detail\.recordType !== 'tag-order'/)
})

test('content autosave batching remains intact while visual refresh becomes faster', () => {
  assert.match(notesWorkspace, /window\.setTimeout\(\(\) => \{\s*void flushPendingContent\(\)\s*\}, 550\)/)
})
