import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const privacyRuntime = readFileSync('src/features/privacy/NoteBulkPrivacyRuntime.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')

test('el gesto touch se reserva desde pointerdown y conserva scroll manual antes del long press', () => {
  assert.match(runtime, /const LONG_PRESS_MS = 280/)
  assert.match(runtime, /const MOVE_CANCEL_PX = 10/)
  assert.match(css, /touch-action: none !important/)
  assert.match(runtime, /event\.pointerType !== 'touch'/)
  assert.match(runtime, /list\.setPointerCapture\(event\.pointerId\)/)
  assert.match(runtime, /gesture\.list\.scrollTop -= event\.clientY - previousY/)
  assert.match(runtime, /if \(!gesture\.scrolling && distance >= MOVE_CANCEL_PX\)/)
  assert.match(runtime, /gesture\.scrolling = true/)
  assert.match(runtime, /document\.addEventListener\('pointermove', onPointerMove, \{ capture: true, passive: false \}\)/)
})

test('el drag usa el mismo pointerId, clon fixed y placeholder real sin mover filas React', () => {
  assert.match(runtime, /event\.pointerId !== gesture\.pointerId/)
  assert.match(runtime, /createClone/)
  assert.match(runtime, /createPlaceholder/)
  assert.match(runtime, /positionClone/)
  assert.match(runtime, /updatePlaceholder/)
  assert.match(runtime, /orderFromPlaceholder/)
  assert.match(runtime, /gesture\.item\.style\.display = 'none'/)
  assert.match(runtime, /gesture\.list\.insertBefore\(placeholder, row\)/)
  assert.match(css, /oanix-mobile-note-placeholder/)
  assert.match(css, /oanix-mobile-note-drag-ghost/)
  assert.match(runtime, /persistNoteOrder\(nextOrder\)/)
  assert.match(runtime, /oanix:workspace-refresh/)
})

test('pointer capture se libera y pointercancel limpia el gesto', () => {
  assert.match(runtime, /hasPointerCapture\(gesture\.pointerId\)/)
  assert.match(runtime, /releasePointerCapture\(gesture\.pointerId\)/)
  assert.match(runtime, /pointercancel/)
  assert.match(runtime, /lostpointercapture/)
  assert.match(runtime, /visibilitychange/)
  assert.match(runtime, /window\.addEventListener\('blur'/)
  assert.match(runtime, /gesture\.clone\?\.remove\(\)/)
  assert.match(runtime, /gesture\.placeholder\?\.remove\(\)/)
})

test('el clon queda dentro de notes-list y el auto-scroll usa sus bordes', () => {
  assert.match(runtime, /function clamp\(/)
  assert.match(runtime, /listRect\.right - width/)
  assert.match(runtime, /listRect\.bottom - height/)
  assert.match(runtime, /scrollSpeed/)
  assert.match(runtime, /gesture\.list\.scrollTop \+= speed/)
})

test('notas fijadas y no fijadas no se mezclan al mover placeholder', () => {
  assert.match(runtime, /function rowPinned/)
  assert.match(runtime, /rowPinned\(row\) === pinned/)
})

test('selección contexto y drag nativos están bloqueados', () => {
  assert.match(css, /-webkit-user-select: none !important/)
  assert.match(css, /user-select: none !important/)
  assert.match(css, /-webkit-touch-callout: none !important/)
  assert.match(runtime, /contextmenu/)
  assert.match(runtime, /selectstart/)
  assert.match(runtime, /dragstart/)
  assert.match(runtime, /window\.getSelection\(\)\?\.removeAllRanges\(\)/)
})

test('controles interactivos y marcado múltiple no compiten con el drag', () => {
  assert.match(runtime, /button, a, input, textarea, select/)
  assert.match(runtime, /oanix-note-bulk-selecting/)
  assert.match(privacyRuntime, /\.notes-create-fab/)
  assert.match(privacyRuntime, /data-oanix-bulk-mode/)
})

test('NotesWorkspace no conserva el motor manual retirado', () => {
  assert.doesNotMatch(workspace, /reorderMode|orderingBusy|draggingNoteId|dragTargetId|dragPlacement/)
  assert.doesNotMatch(workspace, /handleReorderPointer|persistDraggedOrder|autoScrollNoteList/)
  assert.doesNotMatch(workspace, /ReactPointerEvent|persistNoteOrder/)
})

test('el runtime solo vive durante la sesión desbloqueada', () => {
  assert.match(app, /<NoteListReorderGestureRuntime key=\{`note-reorder-\$\{workspaceRevision\}`\} \/>/)
})
