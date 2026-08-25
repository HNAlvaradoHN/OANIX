import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
const folderRuntime = readFileSync('src/features/folders/FolderMobileDragRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const privacyRuntime = readFileSync('src/features/privacy/NoteBulkPrivacyRuntime.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')

test('reorder móvil de notas replica el motor probado de carpetas', () => {
  for (const contract of [
    /const LONG_PRESS_MS = 340/,
    /const PRESS_ARM_GRACE_MS = 55/,
    /const MOVE_CANCEL_PX = 14/,
    /const EDGE_SCROLL_PX = 72/,
    /const MAX_SCROLL_PER_FRAME = 9/,
    /setPointerCapture/,
    /document\.addEventListener\('pointerdown'/,
    /document\.addEventListener\('pointermove'/,
    /document\.addEventListener\('pointerup'/,
    /document\.addEventListener\('pointercancel'/,
  ]) {
    assert.match(folderRuntime, contract)
    assert.match(runtime, contract)
  }
  assert.doesNotMatch(runtime, /sortablejs|Sortable\.create/)
  assert.match(css, /touch-action: none !important/)
})

test('scroll previo al long press usa el mismo patrón manual que carpetas, en eje vertical', () => {
  assert.match(runtime, /startScrollTop: list\.scrollTop/)
  assert.match(runtime, /gesture\.list\.scrollTop = gesture\.startScrollTop - dy/)
  assert.match(runtime, /Math\.abs\(dy\) >= Math\.abs\(dx\)/)
})

test('ghost, slot y reflow siguen el patrón de carpetas', () => {
  assert.match(runtime, /function createGhost/)
  assert.match(runtime, /function positionGhost/)
  assert.match(runtime, /function snapshotRects/)
  assert.match(runtime, /function animateReflow/)
  assert.match(runtime, /function reorderDomAtPoint/)
  assert.match(css, /oanix-mobile-note-drag-source/)
  assert.match(css, /oanix-mobile-note-drag-ghost/)
  assert.match(css, /position: fixed !important/)
})

test('auto-scroll vertical replica el edge scroll de carpetas', () => {
  assert.match(runtime, /function scrollSpeed\(clientY: number/)
  assert.match(runtime, /gesture\.list\.scrollTop \+= speed/)
  assert.match(runtime, /requestAnimationFrame\(tick\)/)
})

test('notas fijadas y no fijadas no se mezclan', () => {
  assert.match(runtime, /function rowPinned/)
  assert.match(runtime, /rowPinned\(row\) === pinned/)
})

test('controles interactivos y selección múltiple no compiten con reorder', () => {
  assert.match(runtime, /function noteItem/)
  assert.match(runtime, /note-row__menu-wrap, button, a, input, textarea, select/)
  assert.match(runtime, /oanix-note-bulk-selecting/)
  assert.match(privacyRuntime, /data-oanix-bulk-mode/)
})

test('orden se persiste una sola vez al soltar y se restaura en fallo', () => {
  assert.match(runtime, /const persistAndFinish = async/)
  assert.match(runtime, /const nextOrder = noteOrder\(finished\.list\)/)
  assert.match(runtime, /persistNoteOrder\(nextOrder\)/)
  assert.match(runtime, /restoreDomOrder\(finished\.list, finished\.orderBefore\)/)
  assert.match(runtime, /oanix:workspace-refresh/)
})

test('NotesWorkspace no conserva otro motor de reorder', () => {
  assert.doesNotMatch(workspace, /reorderMode|orderingBusy|draggingNoteId|dragTargetId|dragPlacement/)
  assert.doesNotMatch(workspace, /handleReorderPointer|persistDraggedOrder|autoScrollNoteList/)
  assert.doesNotMatch(workspace, /ReactPointerEvent|persistNoteOrder/)
})

test('runtime sigue remontándose con cada revisión del workspace', () => {
  assert.doesNotMatch(runtime, /new MutationObserver/)
  assert.match(app, /<NoteListReorderGestureRuntime key=\{`note-reorder-\$\{workspaceRevision\}`\} \/>/)
})
