import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')
const folderManager = readFileSync('src/features/folders/FolderScopedManagerRuntime.tsx', 'utf8')
const folderDrag = readFileSync('src/features/folders/FolderMobileDragRuntime.tsx', 'utf8')
const noteFeedback = readFileSync('src/features/notes/NoteCreationFeedbackRuntime.tsx', 'utf8')
const noteIdentity = readFileSync('src/features/notes/NoteVisualIdentityRuntime.tsx', 'utf8')
const noteReorder = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
const noteReorderCss = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')
const bulkPrivacy = readFileSync('src/features/privacy/NoteBulkPrivacyRuntime.tsx', 'utf8')
const infographicTheme = readFileSync('src/features/notes/themes/infographic/InfographicWorkspace.tsx', 'utf8')

test('folder manager is scoped by explicit event and bypasses hidden DOM bridges', () => {
  assert.match(folderManager, /renameFolder/)
  assert.match(folderManager, /deleteFolder/)
  assert.match(folderManager, /moveNoteToFolder\(note\.id, null\)/)
  assert.match(folderManager, /oanix:open-folder-manager/)
  assert.doesNotMatch(folderManager, /oanix-folder-focus|oanix-folder-customizer__actions|stopImmediatePropagation/)
  assert.match(legacyGate, /<FolderScopedManagerRuntime \/>/)
  assert.doesNotMatch(legacyGate, /FolderCustomizerBridgeRuntime/)
})

test('folder wheel supports the vertical desktop rail and horizontal variants', () => {
  assert.match(folderDrag, /scrollHeight > rail\.clientHeight \+ 1/)
  assert.match(folderDrag, /rail\.scrollTop \+= event\.deltaY/)
  assert.match(folderDrag, /scrollWidth > rail\.clientWidth \+ 1/)
  assert.match(folderDrag, /rail\.scrollLeft \+= delta/)
})

test('launcher click does not show creating feedback until creation really becomes busy', () => {
  assert.match(noteFeedback, /const EMPTY_CREATE_BUTTON_SELECTOR = '\.notes-empty \.empty-action'/)
  assert.match(noteFeedback, /const busy = buttons\.some\(\(button\) => button\.disabled && \/creando\/i\.test/)
  assert.match(noteFeedback, /if \(busy && !document\.getElementById\(FEEDBACK_ID\)\)/)
  assert.match(noteFeedback, /event\.target instanceof Element[\s\S]*EMPTY_CREATE_BUTTON_SELECTOR/)
  assert.doesNotMatch(noteFeedback, /closest<HTMLButtonElement>\(CREATE_BUTTON_SELECTOR\)/)
})

test('create-note action no longer detours through bulk marking', () => {
  assert.match(infographicTheme, /className="notes-create-fab fab-add-note"[\s\S]*onClick=\{onCreateNote\}/)
  assert.doesNotMatch(bulkPrivacy, /Marcar notas|data-oanix-bulk-mode|selectionMode/)
  assert.doesNotMatch(bulkPrivacy, /\.notes-create-fab/)
})

test('note drag keeps Sortable ordering but renders an independent visible overlay', () => {
  assert.match(noteReorder, /forceFallback: false/)
  assert.match(noteReorder, /fallbackOnBody: false/)
  assert.match(noteReorder, /cloneNode\(true\)/)
  assert.match(noteReorder, /createDragOverlay\(touchGesture\.item/)
  assert.doesNotMatch(noteReorder, /createDragOverlay\(event\.item/) 
  assert.match(noteReorder, /oanix-mobile-note-drag-overlay/)
  assert.match(noteReorder, /document\.addEventListener\('pointermove', onTouchPointerMove/)
  assert.doesNotMatch(noteReorder, /document\.addEventListener\('touchmove'/)
  assert.doesNotMatch(noteReorderCss, /body > \.note-row\.oanix-mobile-note-drag-ghost/)
  assert.match(noteReorderCss, /.notes-shell > \.note-row\.oanix-mobile-note-drag-overlay[\s\S]*position:\s*fixed !important/)
  assert.match(noteReorderCss, /.notes-shell > \.note-row\.oanix-mobile-note-drag-overlay[\s\S]*z-index:\s*10050 !important/)
})

test('note color becomes authoritative only after identity is resolved by note id', () => {
  assert.match(noteIdentity, /--oanix-note-stable-color/)
  assert.match(noteIdentity, /row\.dataset\.oanixNoteStableVisual = 'true'/)
  assert.match(noteReorderCss, /\.note-row\[data-oanix-note-stable-visual='true'\]/)
  assert.match(noteReorderCss, /--oanix-note-card-color:\s*var\(--oanix-note-stable-color\) !important/)
  assert.match(noteReorderCss, /--oanix-note-tab-color:\s*var\(--oanix-note-stable-color\) !important/)
})