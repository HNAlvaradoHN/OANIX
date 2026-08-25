import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('organic workspace uses real OANIX data and no external prototype dependencies', () => {
  const runtime = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
  const css = readFileSync('src/features/notes/organicWorkspace.css', 'utf8')
  const app = readFileSync('src/app/App.tsx', 'utf8')
  const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

  assert.match(runtime, /loadFolders/)
  assert.match(runtime, /loadNotes/)
  assert.match(runtime, /loadTags/)
  assert.match(runtime, /loadFolderCovers/)
  assert.match(runtime, /loadFolderColors/)
  assert.match(runtime, /persistTagOrder/)
  assert.match(app, /<WorkspaceRuntimeGate \/>/)
  assert.match(gate, /<OrganicWorkspaceRuntime \/>/)
  assert.doesNotMatch(runtime + css + gate, /cdn\.tailwindcss|unpkg\.com|@phosphor-icons/)
})

test('folders become a bottom dock and old duplicate navigation stays only as a hidden handler', () => {
  const css = readFileSync('src/features/notes/organicWorkspace.css', 'utf8')
  const runtime = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')

  assert.match(css, /\.notes-tabs-shell \{ display: none !important; \}/)
  assert.match(css, /\.oanix-folder-grid[\s\S]*inset: auto 0 0 !important/)
  assert.match(css, /\.oanix-folder-rail[\s\S]*flex-direction: row !important/)
  assert.match(runtime, /selectWorkspaceFolderFromDock/)
  assert.match(runtime, /\.notes-tab:not\(\.notes-tab--add\)/)
})

test('folders, tags and notes finish reordering automatically after release', () => {
  const organic = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
  const noteGesture = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
  const noteCss = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')

  assert.match(organic, /TAG_LONG_PRESS_MS = 460/)
  assert.match(organic, /finishFolderReorder/)
  assert.match(organic, /\.oanix-folder-rail__done/)
  assert.match(organic, /finishTagDrag/)
  assert.match(noteGesture, /const LONG_PRESS_MS = 300/)
  assert.match(noteGesture, /Sortable\.create\(list/)
  assert.match(noteGesture, /delayOnTouchOnly: true/)
  assert.match(noteGesture, /forceFallback: true/)
  assert.doesNotMatch(noteGesture, /supportPointer:\s*false/)
  assert.match(noteGesture, /persistNoteOrder\(nextOrder\)/)
  assert.match(noteCss, /touch-action: pan-y !important/)
  assert.doesNotMatch(noteGesture, /setPointerCapture|pointermove|pointercancel|PRESS_ARM_GRACE_MS|finishAutomaticMode|dispatchDragStart|new PointerEvent/)
  assert.doesNotMatch(noteCss, /oanix-note-jiggle|data-oanix-note-reorder-mode/)
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
