import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('organic workspace uses real OANIX data and no external prototype dependencies', () => {
  const runtime = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
  const css = readFileSync('src/features/notes/organicWorkspace.css', 'utf8')
  const app = readFileSync('src/app/App.tsx', 'utf8')
  const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')

  assert.match(runtime, /loadFolders/)
  assert.doesNotMatch(runtime, /loadNotes|loadNote\(/)
  assert.match(runtime, /loadTags/)
  assert.match(runtime, /loadFolderCovers/)
  assert.match(runtime, /loadFolderColors/)
  assert.doesNotMatch(runtime, /NOTE_TAB_COLORS|row\.dataset\.oanixNoteCategory|--oanix-note-tab-color/)
  assert.match(runtime, /persistTagOrder/)
  assert.match(app, /<WorkspaceRuntimeGate workspaceRevision=\{workspaceRevision\} \/>/)
  assert.match(legacyGate, /<OrganicWorkspaceRuntime \/>/)
  assert.doesNotMatch(runtime + css + legacyGate, /cdn\.tailwindcss|unpkg\.com|@phosphor-icons/)
})

test('folders become a bottom dock and deterministic selection replaces the old hidden click bridge', () => {
  const css = readFileSync('src/features/notes/organicWorkspace.css', 'utf8')
  const runtime = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
  const folderGrid = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')

  assert.match(css, /\.notes-tabs-shell \{ display: none !important; \}/)
  assert.match(css, /\.oanix-folder-grid[\s\S]*inset: auto 0 0 !important/)
  assert.match(css, /\.oanix-folder-rail[\s\S]*flex-direction: row !important/)
  assert.match(folderGrid, /oanix:select-workspace-folder/)
  assert.match(runtime, /oanix:workspace-folder-committed/)
  assert.doesNotMatch(runtime, /selectWorkspaceFolderFromDock/)
  assert.doesNotMatch(runtime, /\.notes-tab:not\(\.notes-tab--add\)/)
})

test('folders, tags and notes finish reordering automatically after release', () => {
  const organic = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
  const noteGesture = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
  const noteCss = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')

  assert.match(organic, /TAG_LONG_PRESS_MS = 460/)
  const folderGrid = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')
  assert.match(folderGrid, /function finishFolderDrag/)
  assert.match(folderGrid, /setReorderMode\(false\)/)
  assert.doesNotMatch(organic, /finishFolderReorder|\.oanix-folder-rail__done|data-oanix-folder-drop-finishing/)
  assert.match(organic, /finishTagDrag/)
  assert.match(organic, /tagDropTargetAtX/)
  assert.match(organic, /moveTagOneStepTowardTarget/)
  assert.match(organic, /oanix:tag-reorder-edge-tick/)
  assert.match(organic, /advanceTagDragAtX/)
  assert.match(organic, /tagReflowAnimations\.get\(element\)\?\.cancel\(\)/)
  assert.match(noteGesture, /const LONG_PRESS_MS = 220/)
  assert.match(noteGesture, /Sortable\.create\(list/)
  assert.match(noteGesture, /delayOnTouchOnly: true/)
  assert.match(noteGesture, /forceFallback: false/)
  assert.doesNotMatch(noteGesture, /supportPointer:\s*false/)
  assert.match(noteGesture, /persistNoteOrder\(orderToPersist, \(\) => !disposed && pendingPersistOrder === null\)/)
  assert.match(noteCss, /touch-action: none !important/)
  // Mobile note reorder now deliberately mirrors the proven folder pointer
  // architecture: pointer capture is allowed, synthetic drag fabrication is not.
  assert.match(noteGesture, /setPointerCapture\(touchGesture\.pointerId\)/)
  assert.doesNotMatch(noteGesture, /finishAutomaticMode|dispatchDragStart|new PointerEvent|elementFromPoint|TouchEvent/)
  assert.doesNotMatch(noteCss, /oanix-note-jiggle|data-oanix-note-reorder-mode/)
})

test('rapid reorder persistence stays serialized without blocking the next gesture', () => {
  const organic = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
  const folderGrid = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')
  const noteGesture = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
  const noteService = readFileSync('src/features/notes/noteService.ts', 'utf8')

  assert.match(noteGesture, /pendingPersistOrder/)
  assert.match(noteGesture, /if \(persistLoop\) return/)
  assert.match(folderGrid, /pendingFolderOrderRef/)
  assert.match(folderGrid, /folderOrderPersistingRef/)
  assert.doesNotMatch(folderGrid, /orderingBusy|setOrderingBusy/)
  assert.match(organic, /pendingTagOrderRef/)
  assert.match(organic, /tagOrderPersistingRef/)
  assert.doesNotMatch(organic, /event\.button !== 0 \|\| tagOrderingBusy/)
  assert.match(noteService, /historyReason: NoteHistoryReason \| null = 'automatic'/)
  assert.match(noteService, /manualOrder,[\s\S]*?\}\), null, false\)/)
  assert.match(noteService, /if \(!shouldContinue\(\)\) break/)
  assert.match(noteService, /setTimeout\(resolve, 0\)/)
})

test('organic tag chips filter directly without opening the legacy filter dialog', () => {
  const organic = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
  const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')

  assert.match(organic, /oanix:select-workspace-tag/)
  assert.match(organic, /selectWorkspaceTag\(tag\.id\)/)
  assert.match(organic, /selectWorkspaceTag\(null\)/)
  assert.doesNotMatch(organic, /folder-dialog__panel\[aria-label="Filtrar por etiqueta"\]/)
  assert.doesNotMatch(organic, /filterButton\.click\(\)/)
  assert.match(workspace, /window\.addEventListener\('oanix:select-workspace-tag'/)
  assert.match(workspace, /activeTagIdRef/)
  assert.match(workspace, /void handleSelectTag\('all'\)/)
  assert.match(workspace, /void handleSelectTag\(detail\.tagId\)/)
})

test('manual tag order reuses encrypted records and remains backward compatible with tag records', () => {
  const repository = readFileSync('src/storage/repositories/tagRepository.ts', 'utf8')
  const service = readFileSync('src/features/tags/tagService.ts', 'utf8')
  const types = readFileSync('src/features/tags/tagTypes.ts', 'utf8')

  assert.match(repository, /TAG_ORDER_RECORD_TYPE = 'tag-order'/)
  assert.match(repository, /readEncryptedRecord/)
  assert.match(repository, /writeEncryptedRecord/)
  assert.match(service, /persistTagOrder/)
  assert.match(service, /applyTagOrder/)
  assert.match(types, /version: 1/)
  assert.doesNotMatch(repository + service, /localStorage|sessionStorage|indexedDB|caches\.open/)
})

test('organic workspace keeps mobile viewport protections instead of copying fixed demo geometry blindly', () => {
  const css = readFileSync('src/features/notes/organicWorkspace.css', 'utf8')

  assert.match(css, /100dvh/)
  assert.match(css, /env\(safe-area-inset-bottom\)/)
  assert.match(css, /@media \(max-width: 760px\)/)
  assert.match(css, /@media \(max-width: 480px\)/)
  assert.match(css, /overflow-x: auto !important/)
  assert.match(css, /prefers-reduced-motion/)
})
