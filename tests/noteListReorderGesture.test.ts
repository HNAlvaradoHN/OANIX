import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const privacyRuntime = readFileSync('src/features/privacy/NoteBulkPrivacyRuntime.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')

test('reorder móvil usa el mismo patrón pointer/long-press que carpetas', () => {
  assert.doesNotMatch(runtime, /sortablejs|Sortable\.create/)
  assert.match(runtime, /const LONG_PRESS_MS = 340/)
  assert.match(runtime, /const PRESS_ARM_GRACE_MS = 55/)
  assert.match(runtime, /const MOVE_CANCEL_PX = 14/)
  assert.match(runtime, /addEventListener\('pointerdown'/)
  assert.match(runtime, /addEventListener\('pointermove'/)
  assert.match(runtime, /addEventListener\('pointerup'/)
  assert.match(runtime, /addEventListener\('pointercancel'/)
  assert.match(runtime, /setPointerCapture/)
})

test('avatar es el único handle táctil y reserva el gesto', () => {
  assert.match(runtime, /target\.closest<HTMLElement>\('\.note-row__avatar'\)/)
  assert.match(runtime, /avatar\.closest<HTMLElement>\('\.note-row\[data-reorder-note-id\]'\)/)
  assert.match(css, /html\.oanix-v383-visual[\s\S]*?\.note-row\[data-reorder-note-id\][\s\S]*?\.note-row__avatar\[data-oanix-note-icon\]\s*\{[\s\S]*?pointer-events:\s*auto !important;[\s\S]*?touch-action:\s*none !important/)
})

test('drag crea copia elevada y deja un hueco vivo como carpetas', () => {
  assert.match(runtime, /function createGhost/)
  assert.match(runtime, /cloneNode\(true\)/)
  assert.match(runtime, /oanix-mobile-note-drag-ghost/)
  assert.match(runtime, /oanix-mobile-note-drag-source/)
  assert.match(runtime, /positionGhost\(gesture\)/)
  assert.match(css, /note-row\.oanix-mobile-note-drag-source/)
  assert.match(css, /border:\s*2px dashed/)
  assert.match(css, /note-row\.oanix-mobile-note-drag-ghost[\s\S]*position:\s*fixed !important/)
  assert.match(css, /note-row\.oanix-mobile-note-drag-source > \*[\s\S]*visibility:\s*hidden !important/)
})

test('reflow y auto-scroll siguen el dedo en vertical', () => {
  assert.match(runtime, /function animateReflow/)
  assert.match(runtime, /function reorderDomAtPoint/)
  assert.match(runtime, /gesture\.lastY < rect\.top \+ rect\.height \/ 2/)
  assert.match(runtime, /window\.scrollBy\(0, speed\)/)
  assert.match(runtime, /requestAnimationFrame\(tick\)/)
})

test('notas fijadas y no fijadas no se mezclan', () => {
  assert.match(runtime, /function rowPinned/)
  assert.match(runtime, /rowPinned\(row\) === gesture\.pinned/)
})

test('selección múltiple y búsqueda bloquean reorder', () => {
  assert.match(runtime, /function interactionBlocked/)
  assert.match(runtime, /oanix-note-bulk-selecting/)
  assert.match(runtime, /notes-shell--searching/)
  assert.match(privacyRuntime, /data-oanix-bulk-mode/)
})

test('orden se persiste una sola vez al finalizar y revierte si falla', () => {
  assert.match(runtime, /const nextOrder = noteOrder\(finished\.list\)/)
  assert.match(runtime, /persistNoteOrder\(nextOrder\)/)
  assert.match(runtime, /restoreDomOrder\(finished\.list, finished\.orderBefore\)/)
  assert.match(runtime, /oanix:workspace-refresh/)
})

test('selección y menú contextual nativos siguen bloqueados', () => {
  assert.match(css, /-webkit-user-select: none !important/)
  assert.match(css, /user-select: none !important/)
  assert.match(css, /-webkit-touch-callout: none !important/)
  assert.match(runtime, /contextmenu/)
  assert.match(runtime, /selectstart/)
  assert.match(runtime, /window\.getSelection\(\)\?\.removeAllRanges\(\)/)
})

test('NotesWorkspace no conserva otro motor de reorder', () => {
  assert.doesNotMatch(workspace, /reorderMode|orderingBusy|draggingNoteId|dragTargetId|dragPlacement/)
  assert.doesNotMatch(workspace, /handleReorderPointer|persistDraggedOrder|autoScrollNoteList/)
  assert.doesNotMatch(workspace, /ReactPointerEvent|persistNoteOrder/)
})

test('runtime queda ligado a la lista actual y React lo remonta con cada revision', () => {
  assert.match(runtime, /const list = document\.querySelector<HTMLElement>\('\.notes-list'\)/)
  assert.match(runtime, /list\?\.classList\.contains\('notes-list'\)/)
  assert.doesNotMatch(runtime, /new MutationObserver/)
  assert.match(app, /<NoteListReorderGestureRuntime key=\{`note-reorder-\$\{workspaceRevision\}`\} \/>/)
})
