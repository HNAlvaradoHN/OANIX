import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')
const privacyRuntime = readFileSync('src/features/privacy/NoteBulkPrivacyRuntime.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')

test('la pulsación larga arma el orden sin robar el scroll previo', () => {
  assert.match(runtime, /target\.closest<HTMLElement>\('\.note-row__open'\)/)
  assert.match(runtime, /const NOTE_REORDER_LONG_PRESS_MS = 460/)
  assert.match(runtime, /const NOTE_REORDER_MOVE_TOLERANCE = 12/)
  assert.match(runtime, /const NOTE_REORDER_DRAG_START_PX = 4/)
  assert.match(runtime, /holdReady = true/)
  assert.match(runtime, /Math\.hypot\(event\.clientX - startX, event\.clientY - startY\)/)
  assert.match(runtime, /resetPress\(\)/)
})

test('arrastre y selección múltiple comparten la pulsación larga sin dispararse a la vez', () => {
  assert.match(privacyRuntime, /const LONG_PRESS_MS = 760/)
  assert.match(runtime, /NOTE_BULK_SELECTION_START_EVENT = 'oanix:note-bulk-selection-start'/)
  assert.match(privacyRuntime, /NOTE_BULK_SELECTION_START_EVENT = 'oanix:note-bulk-selection-start'/)
  assert.match(runtime, /data-oanix-note-drag-active/)
  assert.match(privacyRuntime, /data-oanix-note-drag-active/)
  assert.match(runtime, /handleBulkSelectionStart/)
  assert.match(runtime, /event\.stopImmediatePropagation\(\)/)
})

test('el botón superior de ordenar desaparece pero se reutiliza el motor manual existente', () => {
  assert.match(runtime, /Ordenar notas manualmente/)
  assert.match(runtime, /Terminar de ordenar notas/)
  assert.match(css, /button\[aria-label="Ordenar notas manualmente"\]/)
  assert.match(css, /display: none !important/)
})

test('el gesto inicia el drag real, muestra una tarjeta flotante y termina visualmente al soltar', () => {
  assert.match(css, /oanix-note-jiggle/)
  assert.match(css, /aria-label\^="Orden manual de /)
  assert.match(runtime, /dispatchDragStart/)
  assert.match(runtime, /new PointerEvent\('pointerdown'/)
  assert.match(runtime, /navigator\.vibrate\?\.\(18\)/)
  assert.match(runtime, /createDragGhost/)
  assert.match(runtime, /moveDragGhost/)
  assert.match(css, /\.oanix-note-drag-ghost/)
  assert.match(runtime, /finishAutomaticMode/)
  assert.match(runtime, /document\.body\.removeAttribute\('data-oanix-note-reorder-mode'\)/)
  assert.match(runtime, /document\.addEventListener\('pointercancel', handlePointerEnd\)/)
  assert.doesNotMatch(runtime, /oanix-note-reorder-menu-proxy/)
  assert.doesNotMatch(runtime, /oanix-note-reorder-done/)
  assert.match(css, /prefers-reduced-motion: reduce/)
})

test('el runtime de gesto solo vive durante la sesión desbloqueada', () => {
  assert.match(app, /<NoteListReorderGestureRuntime key=\{`note-reorder-\$\{workspaceRevision\}`\} \/>/)
})
