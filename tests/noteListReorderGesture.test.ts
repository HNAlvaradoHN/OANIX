import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const privacyRuntime = readFileSync('src/features/privacy/NoteBulkPrivacyRuntime.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const pkg = readFileSync('package.json', 'utf8')

test('reorder móvil usa SortableJS y devuelve el scroll al navegador', () => {
  assert.match(pkg, /"sortablejs": "1\.15\.7"/)
  assert.match(runtime, /import Sortable from 'sortablejs'/)
  assert.match(runtime, /Sortable\.create\(list/)
  assert.match(runtime, /const LONG_PRESS_MS = 300/)
  assert.match(runtime, /delay: LONG_PRESS_MS/)
  assert.match(runtime, /delayOnTouchOnly: true/)
  assert.match(runtime, /touchStartThreshold: 7/)
  assert.match(runtime, /supportPointer: false/)
  assert.match(css, /touch-action: pan-y !important/)
  assert.doesNotMatch(runtime, /setPointerCapture|scrollTop -=|pointermove|pointercancel/)
})

test('fallback táctil crea ghost y placeholder sin CSS que pise transform', () => {
  assert.match(runtime, /forceFallback: true/)
  assert.match(runtime, /fallbackOnBody: true/)
  assert.match(runtime, /fallbackTolerance: 4/)
  assert.match(runtime, /fallbackClass: 'oanix-mobile-note-drag-ghost'/)
  assert.match(runtime, /ghostClass: 'oanix-mobile-note-placeholder'/)
  assert.match(css, /oanix-mobile-note-drag-ghost/)
  assert.match(css, /oanix-mobile-note-placeholder/)
  assert.doesNotMatch(css, /oanix-mobile-note-drag-ghost[\s\S]{0,500}transform:/)
  assert.doesNotMatch(css, /@keyframes oanix-note-drag-pulse/)
})

test('auto-scroll y orden vertical pertenecen a SortableJS', () => {
  assert.match(runtime, /direction: 'vertical'/)
  assert.match(runtime, /scroll: true/)
  assert.match(runtime, /scrollSensitivity: 72/)
  assert.match(runtime, /scrollSpeed: 12/)
  assert.match(runtime, /bubbleScroll: false/)
  assert.match(runtime, /swapThreshold: 0\.62/)
})

test('notas fijadas y no fijadas no se mezclan', () => {
  assert.match(runtime, /function rowPinned/)
  assert.match(runtime, /rowPinned\(event\.dragged\) === rowPinned\(event\.related\)/)
})

test('controles interactivos y selección múltiple no compiten con reorder', () => {
  assert.match(runtime, /filter: '.note-row__menu-wrap, button, a, input, textarea, select/)
  assert.match(runtime, /preventOnFilter: false/)
  assert.match(runtime, /oanix-note-bulk-selecting/)
  assert.match(runtime, /sortable\.option\('disabled', interactionBlocked\(\)\)/)
  assert.match(privacyRuntime, /data-oanix-bulk-mode/)
})

test('orden se persiste una sola vez al finalizar', () => {
  assert.match(runtime, /onEnd:/)
  assert.match(runtime, /const nextOrder = noteOrder\(listElement\)/)
  assert.match(runtime, /persistNoteOrder\(nextOrder\)/)
  assert.match(runtime, /oanix:workspace-refresh/)
  assert.doesNotMatch(runtime, /persistNoteOrder[\s\S]{0,120}onMove/)
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

test('runtime se vuelve a conectar si React reemplaza la lista', () => {
  assert.match(runtime, /new MutationObserver\(attach\)/)
  assert.match(runtime, /sortable\?\.destroy\(\)/)
  assert.match(app, /<NoteListReorderGestureRuntime key=\{`note-reorder-\$\{workspaceRevision\}`\} \/>/)
})
