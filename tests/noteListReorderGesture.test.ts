import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const privacyRuntime = readFileSync('src/features/privacy/NoteBulkPrivacyRuntime.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')

test('el arrastre de notas usa pulsación larga directa y conserva el scroll previo', () => {
  assert.match(runtime, /const LONG_PRESS_MS = 340/)
  assert.match(runtime, /const PRESS_ARM_GRACE_MS = 55/)
  assert.match(runtime, /const MOVE_CANCEL_PX = 14/)
  assert.match(runtime, /Math\.hypot\(dx, dy\)/)
  assert.match(runtime, /beginDrag\(\)/)
  assert.match(runtime, /navigator\.vibrate\?\.\(24\)/)
})

test('el drag replica el patrón de carpetas con ghost, hueco de destino y reflow', () => {
  assert.match(runtime, /createGhost/)
  assert.match(runtime, /positionGhost/)
  assert.match(runtime, /snapshotRects/)
  assert.match(runtime, /animateReflow/)
  assert.match(runtime, /reorderDomAtPoint/)
  assert.match(runtime, /rect\.top \+ rect\.height \/ 2/)
  assert.match(runtime, /persistNoteOrder\(nextOrder\)/)
  assert.match(runtime, /oanix:workspace-refresh/)
  assert.match(css, /oanix-mobile-note-drag-source/)
  assert.match(css, /oanix-mobile-note-drag-ghost/)
  assert.match(css, /border: 2px dashed/)
})

test('el arrastre ya no depende del modo manual ni de eventos sintéticos', () => {
  assert.doesNotMatch(runtime, /findReorderToggle|finishAutomaticMode|dispatchDragStart/)
  assert.doesNotMatch(runtime, /new PointerEvent/)
  assert.doesNotMatch(runtime, /oanix:note-bulk-selection-start/)
  assert.doesNotMatch(css, /oanix-note-jiggle|data-oanix-note-reorder-mode|data-oanix-note-drop-finishing/)
})

test('NotesWorkspace ya no conserva el motor manual retirado ni un botón oculto de ordenar', () => {
  assert.doesNotMatch(workspace, /reorderMode|orderingBusy|draggingNoteId|dragTargetId|dragPlacement/)
  assert.doesNotMatch(workspace, /handleReorderPointer|persistDraggedOrder|autoScrollNoteList/)
  assert.doesNotMatch(workspace, /Ordenar notas manualmente|Terminar de ordenar notas|Orden manual de/)
  assert.doesNotMatch(workspace, /ReactPointerEvent|persistNoteOrder/)
  assert.doesNotMatch(css, /Ordenar notas manualmente|Terminar de ordenar notas/)
})

test('el marcado se desactiva como gesto y bloquea el drag solo cuando el modo explícito está activo', () => {
  assert.match(runtime, /oanix-note-bulk-selecting/)
  assert.match(privacyRuntime, /\.notes-create-fab/)
  assert.match(privacyRuntime, /data-oanix-bulk-mode/)
  assert.doesNotMatch(privacyRuntime, /LONG_PRESS_MS|pointerdown|note-bulk-selection-start/)
})

test('el runtime de gesto solo vive durante la sesión desbloqueada', () => {
  assert.match(app, /<NoteListReorderGestureRuntime key=\{`note-reorder-\$\{workspaceRevision\}`\} \/>/)
})
