import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/organicWorkspace.css', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')

test('organic workspace uses real OANIX data and no external prototype dependencies', () => {
  assert.match(runtime, /loadFolders\(\)/)
  assert.match(runtime, /loadTags\(\)/)
  assert.match(runtime, /loadNotes\(\)/)
  assert.match(runtime, /loadFolderCovers\(\)/)
  assert.match(runtime, /loadFolderColors\(\)/)
  assert.doesNotMatch(runtime, /https?:\/\//)
  assert.doesNotMatch(css, /https?:\/\//)
})

test('folders become a bottom dock and old duplicate navigation stays only as a hidden handler', () => {
  assert.match(css, /\.oanix-folder-rail/)
  assert.match(css, /position:\s*fixed/)
  assert.match(css, /bottom:/)
  assert.match(css, /\.notes-tabs-shell\s*\{\s*display:\s*none\s*!important/)
  assert.match(runtime, /selectWorkspaceFolderFromDock/)
  assert.match(runtime, /\.notes-tab:not\(\.notes-tab--add\)/)
})

test('folders, tags and notes finish reordering automatically after the pointer is released', () => {
  const organic = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
  const noteGesture = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
  const noteCss = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')

  assert.match(organic, /TAG_LONG_PRESS_MS = 460/)
  assert.match(organic, /finishFolderReorder/)
  assert.match(organic, /\.oanix-folder-rail__done/)
  assert.match(organic, /finishTagDrag/)
  assert.match(noteGesture, /NOTE_REORDER_LONG_PRESS_MS = 460/)
  assert.match(noteGesture, /dispatchDragStart/)
  assert.match(noteGesture, /finishAutomaticMode/)
  assert.doesNotMatch(noteGesture, /oanix-note-reorder-done|oanix-note-reorder-menu-proxy/)
  assert.doesNotMatch(noteCss, /\.oanix-note-reorder-done|\.oanix-note-reorder-menu-proxy/)
})

test('manual tag order reuses encrypted records and remains backward compatible with tag records', () => {
  const service = readFileSync('src/features/tags/tagService.ts', 'utf8')
  const repository = readFileSync('src/storage/repositories/tagRepository.ts', 'utf8')
  const types = readFileSync('src/features/tags/tagTypes.ts', 'utf8')

  assert.match(runtime, /persistTagOrder/)
  assert.match(service, /saveTagOrder/)
  assert.match(repository, /tag-order/)
  assert.match(types, /version:\s*1/)
})

test('organic workspace keeps mobile viewport protections instead of copying fixed demo geometry blindly', () => {
  assert.match(css, /100dvh/)
  assert.match(css, /safe-area-inset-bottom/)
  assert.match(css, /overflow-x:\s*auto/)
  assert.match(css, /max-width:\s*min\(14rem,62vw\)/)
})

test('workspace runtime mounts only after unlock and visual authority stays inside the same app', () => {
  assert.match(app, /<WorkspaceRuntimeGate \/>/)
  assert.match(gate, /<OrganicWorkspaceRuntime \/>/)
  assert.match(gate, /<V383WorkspaceVisualRuntime \/>/)
})
