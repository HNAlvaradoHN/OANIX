import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const privacyRuntime = readFileSync('src/features/privacy/NoteBulkPrivacyRuntime.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')

test('el gesto decide explícitamente entre pulsación scroll y drag', () => {
  assert.match(runtime, /const LONG_PRESS_MS = 220/)
  assert.match(runtime, /const SCROLL_START_PX = 9/)
  assert.match(runtime, /type GesturePhase = 'pressing' \| 'scrolling' \| 'dragging'/)
  assert.match(runtime, /gesture\.phase = 'scrolling'/)
  assert.match(runtime, /gesture\.phase = 'dragging'/)
  assert.match(runtime, /gesture\.list\.scrollTop = gesture\.startScrollTop - \(event\.clientY - gesture\.startY\)/)
})

test('Android no puede entregar el gesto al pan nativo', () => {
  assert.match(css, /touch-action: none !important/)
  assert.match(runtime, /setPointerCapture\(event\.pointerId\)/)
  assert.match(runtime, /document\.addEventListener\('pointermove', onPointerMove, \{ capture: true, passive: false \}\)/)
  assert.doesNotMatch(runtime, /touchstart|touchmove|touchend|touchcancel|GestureInput|findTouch/)
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
  assert.match(runtime, /function pointInsideList\(/)
  assert.match(runtime, /scrollSpeed/)
  assert.match(runtime, /gesture\.list\.scrollTop \+= speed/)
})

test('selección contexto y drag nativos están bloqueados en tarjetas', () => {
  assert.match(css, /-webkit-user-select: none !important/)
  assert.match(css, /user-select: none !important/)
  assert.match(css, /-webkit-touch-callout: none !important/)
  assert.match(runtime, /contextmenu/)
  assert.match(runtime, /selectstart/)
  assert.match(runtime, /dragstart/)
  assert.match(runtime, /window\.getSelection\(\)\?\.removeAllRanges\(\)/)
})

test('cancelación y pérdida de captura limpian el gesto', () => {
  assert.match(runtime, /pointercancel/)
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
})

test('NotesWorkspace no conserva el motor manual retirado', () => {
  assert.doesNotMatch(workspace, /reorderMode|orderingBusy|draggingNoteId|dragTargetId|dragPlacement/)
  assert.doesNotMatch(workspace, /handleReorderPointer|persistDraggedOrder|autoScrollNoteList/)
  assert.doesNotMatch(workspace, /ReactPointerEvent|persistNoteOrder/)
})

test('el runtime solo vive durante la sesión desbloqueada', () => {
  assert.match(app, /<NoteListReorderGestureRuntime key=\{`note-reorder-\$\{workspaceRevision\}`\} \/>/)
})
