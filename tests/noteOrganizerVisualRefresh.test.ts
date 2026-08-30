import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const notesWorkspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const folderCreationCss = readFileSync('src/features/folders/folderCreation.css', 'utf8')
const folderCreation = readFileSync('src/features/folders/FolderCreationRuntime.tsx', 'utf8')
const noteService = readFileSync('src/features/notes/noteService.ts', 'utf8')
const organic = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
const personalization = readFileSync('src/features/notes/WorkspacePersonalizationRuntime.tsx', 'utf8')
const auroraNativeSheet = readFileSync('src/features/notes/themes/aurora-native/AuroraNativeNoteSheet.tsx', 'utf8')

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

test('note organizer sheets keep the body-level dock below the workspace modal stacking context', () => {
  assert.match(
    folderCreationCss,
    /html\.oanix-folder-create-v2:has\(\.folder-dialog__panel\[aria-label="Etiquetas de la nota"\]\) \.oanix-folder-grid/,
  )
  assert.match(
    folderCreationCss,
    /html\.oanix-folder-create-v2:has\(\.folder-dialog__panel\[aria-label="Mover nota a carpeta"\]\) \.oanix-folder-grid/,
  )
  assert.match(folderCreationCss, /\.oanix-organic-folder-controls\s*\{\s*z-index:\s*5 !important;\s*pointer-events:\s*none !important;/)
})

test('single note changes refresh only the note visual owner without decrypting the whole list again', () => {
  assert.match(noteService, /export function loadNote\(noteId: string\): Promise<NoteRecord \| null>/)
  assert.match(noteService, /return readNote\(noteId\)/)

  assert.match(organic, /PRIVATE_UI_RELOAD_DEBOUNCE_MS = 48/)
  assert.match(organic, /detail\?\.recordType === 'note'\) return/)
  assert.doesNotMatch(organic, /refreshChangedNote|loadNotes|loadNote\(/)
  assert.match(organic, /ensureHost\(\)\s*\n\s*void reloadPrivateUiData\(\)/)

  assert.match(personalization, /PERSONALIZATION_RELOAD_DEBOUNCE_MS = 48/)
  assert.match(personalization, /async function refreshChangedNote\(noteId: string\)/)
  assert.match(personalization, /detail\?\.recordType === 'note'/)
  assert.match(personalization, /void refreshChangedNote\(detail\.recordId\)/)
})

test('visual runtimes do not emit duplicate generic change events after encrypted writes', () => {
  const duplicateGenericEvent = /window\.dispatchEvent\(new Event\('oanix:local-data-changed'\)\)/
  assert.doesNotMatch(folderCreation, duplicateGenericEvent)
  assert.doesNotMatch(organic, duplicateGenericEvent)
  assert.doesNotMatch(personalization, duplicateGenericEvent)
  assert.doesNotMatch(folderCreation, /oanix:local-data-changed/)

  assert.match(organic, /detail\?\.recordType === 'note'\) return/)
})

test('manual note persistence stays decoupled from the faster visual refresh', () => {
  assert.doesNotMatch(notesWorkspace, /window\.setTimeout\(\(\) => \{\s*void flushPendingContent\(\)\s*\}, 550\)/)
  assert.match(notesWorkspace, /pendingContentRef\.current = \{ noteId: selectedNote\.id, blocks \}/)
  assert.match(notesWorkspace, /onFlush=\{flushPendingContent\}/)
  assert.match(auroraNativeSheet, /aria-label="Sincronizar y guardar nota ahora"/)
})
