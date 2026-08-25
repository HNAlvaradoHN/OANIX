import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const privacyRuntime = readFileSync('src/features/privacy/NoteBulkPrivacyRuntime.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')

test('el gesto usa estados explícitos y separa scroll rápido de long press', () => {
  assert.match(runtime, /const LONG_PRESS_MS = 220/)
  assert.match(runtime, /const MOVE_CANCEL_PX = 12/)
  assert.match(runtime, /type GesturePhase = 'pressing' \| 'dragging'/)
  assert.match(runtime, /phase: 'pressing'/)
  assert.match(runtime, /gesture\.phase = 'dragging'/)
  assert.match(runtime, /Math\.hypot\(/)
  assert.match(runtime, /if \(distance >= MOVE_CANCEL_PX\) cancelGesture\(\)/)
  assert.doesNotMatch(runtime, /PRESS_ARM_GRACE_MS|pressedAt/)
})

test('el drag táctil usa Touch Events completos y no depende de pointermove en Android', () => {
  assert.match(runtime, /type GestureInput = 'touch' \| 'pointer'/)
  assert.match(runtime, /document\.addEventListener\('touchstart', onTouchStart, \{ capture: true, passive: true \}\)/)
  assert.match(runtime, /document\.addEventListener\('touchmove', onTouchMove, \{ capture: true, passive: false \}\)/)
  assert.match(runtime, /document\.addEventListener\('touchend', onTouchEnd, \{ capture: true, passive: false \}\)/)
  assert.match(runtime, /document\.addEventListener\('touchcancel', onTouchCancel, true\)/)
  assert.match(runtime, /findTouch\(event\.touches, gesture\.touchId\)/)
  assert.match(runtime, /updateDragPoint\(touch\.clientX, touch\.clientY, event\)/)
  assert.match(runtime, /void finishGesture\(event\)/)
  assert.match(runtime, /event\.pointerType === 'touch'/)
})

test('el drag usa ghost e indicador sin reordenar nodos React durante el gesto', () => {
  assert.match(runtime, /createGhost/)
  assert.match(runtime, /positionGhost/)
  assert.match(runtime, /previewOrderAtPoint/)
  assert.match(runtime, /buildNextOrder/)
  assert.match(runtime, /persistNoteOrder\(nextOrder\)/)
  assert.match(runtime, /oanix:workspace-refresh/)
  assert.match(css, /oanix-mobile-note-drag-source/)
  assert.match(css, /oanix-mobile-note-drag-ghost/)
  assert.match(css, /oanix-mobile-note-drop-before/)
  assert.match(css, /oanix-mobile-note-drop-after/)
  assert.doesNotMatch(runtime, /insertBefore|appendChild\(gesture\.item\)/)
})

test('ghost preview y auto-scroll quedan encerrados en la lista', () => {
  assert.match(runtime, /function clamp\(/)
  assert.match(runtime, /listRect\.right - ghostWidth/)
  assert.match(runtime, /listRect\.bottom - ghostHeight/)
  assert.match(runtime, /function pointInsideList\(/)
  assert.match(runtime, /if \(clientY < rect\.top \|\| clientY > rect\.bottom\) return 0/)
})

test('Android no puede apropiarse del long press con selección o drag nativos', () => {
  assert.match(css, /\.note-row\[data-reorder-note-id\],\s*\.note-row\[data-reorder-note-id\] \*/)
  assert.match(css, /-webkit-user-select: none !important/)
  assert.match(css, /user-select: none !important/)
  assert.match(css, /-webkit-touch-callout: none !important/)
  assert.match(runtime, /selectstart/)
  assert.match(runtime, /contextmenu/)
  assert.match(runtime, /dragstart/)
  assert.match(runtime, /window\.getSelection\(\)\?\.removeAllRanges\(\)/)
  assert.match(runtime, /if \(event\?\.cancelable\) event\.preventDefault\(\)/)
})

test('captura cancelación y multitouch tienen salidas explícitas', () => {
  assert.match(runtime, /event\.touches\.length !== 1/)
  assert.match(runtime, /setPointerCapture/)
  assert.match(runtime, /pointercancel/)
  assert.match(runtime, /touchcancel/)
  assert.match(runtime, /lostpointercapture/)
  assert.match(runtime, /visibilitychange/)
  assert.match(runtime, /window\.addEventListener\('blur'/)
  assert.match(runtime, /cleanupVisuals/)
})

test('controles interactivos y marcado múltiple no compiten con el drag', () => {
  assert.match(runtime, /button, a, input, textarea, select/)
  assert.match(runtime, /oanix-note-bulk-selecting/)
  assert.match(privacyRuntime, /\.notes-create-fab/)
  assert.match(privacyRuntime, /data-oanix-bulk-mode/)
  assert.doesNotMatch(privacyRuntime, /LONG_PRESS_MS|pointerdown|note-bulk-selection-start/)
})

test('el arrastre ya no depende del modo manual ni de eventos sintéticos', () => {
  assert.doesNotMatch(runtime, /findReorderToggle|finishAutomaticMode|dispatchDragStart/)
  assert.doesNotMatch(runtime, /new PointerEvent/)
  assert.doesNotMatch(runtime, /oanix:note-bulk-selection-start/)
  assert.doesNotMatch(css, /oanix-note-jiggle|data-oanix-note-reorder-mode|data-oanix-note-drop-finishing/)
})

test('NotesWorkspace no conserva el motor manual retirado', () => {
  assert.doesNotMatch(workspace, /reorderMode|orderingBusy|draggingNoteId|dragTargetId|dragPlacement/)
  assert.doesNotMatch(workspace, /handleReorderPointer|persistDraggedOrder|autoScrollNoteList/)
  assert.doesNotMatch(workspace, /Ordenar notas manualmente|Terminar de ordenar notas|Orden manual de/)
  assert.doesNotMatch(workspace, /ReactPointerEvent|persistNoteOrder/)
})

test('el runtime solo vive durante la sesión desbloqueada', () => {
  assert.match(app, /<NoteListReorderGestureRuntime key=\{`note-reorder-\$\{workspaceRevision\}`\} \/>/)
})
