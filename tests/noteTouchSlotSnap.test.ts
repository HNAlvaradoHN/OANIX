import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')

test('touch coarse usa una ruta propia y no compite con Sortable', () => {
  assert.match(runtime, /const coarsePointer = window\.matchMedia\('\(pointer: coarse\)'\)/)
  assert.match(runtime, /disabled: coarsePointer/)
  assert.match(runtime, /type TouchGesture/)
  assert.match(runtime, /document\.addEventListener\('pointerdown', onTouchPointerDown/)
  assert.match(runtime, /document\.addEventListener\('pointermove', onTouchPointerMove/)
  assert.match(runtime, /document\.addEventListener\('pointerup', finishPointerGesture/)
  assert.doesNotMatch(runtime, /touchend|finishNativeTouchGesture|TouchEvent/)
})

test('el drag tactil se arma y reacomoda con tiempos cortos sin eliminar la proteccion de scroll', () => {
  assert.match(runtime, /const LONG_PRESS_MS = 220/)
  assert.match(runtime, /const TOUCH_MOVE_CANCEL_PX = 12/)
  assert.match(runtime, /const PRESS_ARM_GRACE_MS = 35/)
  assert.match(runtime, /const REFLOW_MS = 120/)
  assert.match(runtime, /animation: 140/)
})

test('la fila real se convierte en slot y se mueve por el punto medio de las notas', () => {
  assert.match(runtime, /classList\.add\('oanix-mobile-note-chosen', 'oanix-mobile-note-placeholder'\)/)
  assert.match(runtime, /function snapshotRects/)
  assert.match(runtime, /const reorderTouchDomAtPoint/)
  assert.match(runtime, /gesture\.lastY < rect\.top \+ rect\.height \/ 2/)
  assert.match(runtime, /list\.insertBefore\(gesture\.item, insertionTarget\)/)
  assert.match(runtime, /list\.appendChild\(gesture\.item\)/)
  assert.match(css, /\.note-row\.oanix-mobile-note-placeholder[\s\S]*border:\s*2px dashed/)
  assert.match(css, /\.note-row\.oanix-mobile-note-placeholder > \*[\s\S]*visibility:\s*hidden !important/)
})

test('el flotante conserva note-row para que coincidan sus estilos y elimina estados de drag heredados', () => {
  assert.match(runtime, /clone\.classList\.remove\('oanix-mobile-note-chosen', 'oanix-mobile-note-placeholder', 'oanix-mobile-note-drag-source', 'oanix-mobile-note-drag-ghost'\)/)
  assert.match(runtime, /clone\.classList\.add\('oanix-mobile-note-drag-overlay'\)/)
  assert.doesNotMatch(runtime, /clone\.className = 'oanix-mobile-note-drag-overlay'/)
  assert.match(runtime, /clone\.querySelector<HTMLElement>\('\.note-row__menu-wrap'\)\?\.remove\(\)/)
  assert.match(runtime, /clone\.style\.setProperty\('position', 'fixed', 'important'\)/)
  assert.match(runtime, /clone\.style\.setProperty\('z-index', '2147483000', 'important'\)/)
  assert.match(css, /body > \.note-row\.oanix-mobile-note-drag-overlay/)
})

test('al soltar conserva el DOM final y persiste exactamente ese orden', () => {
  assert.match(runtime, /const nextOrder = noteOrder\(list\)/)
  assert.match(runtime, /const changed = nextOrder\.join\('\|'\) !== finished\.orderBefore\.join\('\|'\)/)
  assert.match(runtime, /clearDragVisuals\(\)/)
  assert.match(runtime, /if \(changed\) void persistCurrentOrder\(nextOrder\)/)
  assert.match(runtime, /persistNoteOrder\(nextOrder\)/)
})

test('pinned permanece dentro de su grupo y autoscroll sigue activo', () => {
  assert.match(runtime, /const draggedPinned = rowPinned\(gesture\.item\)/)
  assert.match(runtime, /const eligible = all\.filter\(\(row\) => rowPinned\(row\) === draggedPinned\)/)
  assert.match(runtime, /const firstUnpinned = all\.find\(\(row\) => !rowPinned\(row\)\)/)
  assert.match(runtime, /startTouchAutoScroll\(\)/)
  assert.match(runtime, /list\.scrollTop \+= speed/)
  assert.match(runtime, /window\.scrollBy\(0, speed\)/)
})
