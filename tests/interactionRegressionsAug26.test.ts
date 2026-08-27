import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const folderManager = readFileSync('src/features/folders/FolderScopedManagerRuntime.tsx', 'utf8')
const folderDrag = readFileSync('src/features/folders/FolderMobileDragRuntime.tsx', 'utf8')
const noteFeedback = readFileSync('src/features/notes/NoteCreationFeedbackRuntime.tsx', 'utf8')
const noteIdentity = readFileSync('src/features/notes/NoteVisualIdentityRuntime.tsx', 'utf8')
const noteReorder = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
const noteReorderCss = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')
const bulkOverride = readFileSync('src/features/privacy/noteBulkPrivacyOverrides.css', 'utf8')

test('folder manager is scoped to the selected folder and bypasses legacy create flow', () => {
  assert.match(folderManager, /renameFolder/)
  assert.match(folderManager, /deleteFolder/)
  assert.match(folderManager, /moveNoteToFolder\(note\.id, null\)/)
  assert.match(folderManager, /\.oanix-folder-customizer__actions button/)
  assert.match(folderManager, /\.oanix-folder-focus__actions button/)
  assert.match(folderManager, /event\.stopImmediatePropagation\(\)/)
  assert.doesNotMatch(folderManager, /notes-tab--add/)

  const managerIndex = gate.indexOf('<FolderScopedManagerRuntime />')
  const legacyBridgeIndex = gate.indexOf('<FolderCustomizerBridgeRuntime />')
  assert.ok(managerIndex >= 0 && legacyBridgeIndex > managerIndex)
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

test('bulk selection finish control is a green check without overflowing text', () => {
  assert.match(bulkOverride, /html\.oanix-note-bulk-selecting \.notes-create-fab\[data-oanix-bulk-mode\]/)
  assert.match(bulkOverride, /background:\s*linear-gradient\(145deg, #22c55e, #16a34a\) !important/)
  assert.match(bulkOverride, /::before[\s\S]*content:\s*'✓' !important/)
  assert.match(bulkOverride, /::after[\s\S]*content:\s*none !important/)
  assert.doesNotMatch(bulkOverride, /Terminar/)
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