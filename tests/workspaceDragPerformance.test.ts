import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const noteDrag = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
const identity = readFileSync('src/features/notes/NoteVisualIdentityRuntime.tsx', 'utf8')
const personalization = readFileSync('src/features/notes/WorkspacePersonalizationRuntime.tsx', 'utf8')
const organic = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
const folderGrid = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')

test('note pointermove no longer rewrites Sortable options on every frame', () => {
  assert.match(noteDrag, /const syncSortableWithPointer = \(event: PointerEvent\)/)
  assert.match(noteDrag, /sortable\.option\('disabled', event\.pointerType !== 'mouse'\)/)
  assert.match(noteDrag, /document\.addEventListener\('pointerdown', syncSortableWithPointer/)
  assert.doesNotMatch(noteDrag, /document\.addEventListener\('pointermove', syncSortableWithPointer/)
})

test('note identity observes only the list and stays off the active drag hot path', () => {
  assert.match(identity, /const noteList = document\.querySelector<HTMLElement>\('\.notes-list'\)/)
  assert.match(identity, /observer\.observe\(noteList/)
  assert.doesNotMatch(identity, /observer\.observe\(workspace/)
  assert.match(identity, /noteDragActive\(\)/)
  assert.match(identity, /if \(noteDragActive\(\) \|\| applyFrame !== null\) return/)
})

test('workspace decorators do not repaint while any reorder is active', () => {
  for (const runtime of [personalization, organic]) {
    assert.match(runtime, /oanix-mobile-note-dragging/)
    assert.match(runtime, /oanix-mobile-folder-dragging/)
    assert.match(runtime, /oanix-folder-grid--drag-active/)
    assert.match(runtime, /oanix-organic-tags\.is-reordering/)
    assert.match(runtime, /workspaceReorderActive\(\)/)
  }

  assert.match(personalization, /function scheduleDecorate\(\)[\s\S]*if \(workspaceReorderActive\(\)\) return/)
  assert.match(organic, /function scheduleWorkspaceDecorate\(\)[\s\S]*if \(workspaceReorderActive\(\)\) return/)
})

test('folder appearance is direct React state instead of observer repaint work', () => {
  assert.match(folderGrid, /customDraftColor/)
  assert.match(folderGrid, /customDraftIcon/)
  assert.match(folderGrid, /--oanix-folder-color/)
  assert.doesNotMatch(folderGrid, /paintFolders|decorateCustomizer/)
})

test('note drag high-frequency listeners exist only during an active touch gesture', () => {
  assert.match(noteDrag, /let touchGestureListenersAttached = false/)
  assert.match(noteDrag, /function attachTouchGestureListeners\(\)/)
  assert.match(noteDrag, /document\.addEventListener\('pointermove', onTouchPointerMove, \{ capture: true, passive: false \}\)/)
  assert.match(noteDrag, /function detachTouchGestureListeners\(\)/)
  assert.match(noteDrag, /touchGesture = \{[\s\S]*scrollFrame: null,[\s\S]*\}\s*attachTouchGestureListeners\(\)/)
  assert.match(noteDrag, /touchGesture = null\s*detachTouchGestureListeners\(\)/)
  assert.match(
    noteDrag,
    /document\.addEventListener\('pointerdown', onTouchPointerDown, true\)\s*document\.addEventListener\('click', onClick, true\)/,
  )
})
