import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const avatar = readFileSync('src/features/notes/NoteAvatar.tsx', 'utf8')
const privacyRuntime = readFileSync('src/features/privacy/NoteBulkPrivacyRuntime.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const pkg = readFileSync('package.json', 'utf8')

test('reorder móvil usa SortableJS y conserva scroll nativo antes del long press', () => {
  assert.match(pkg, /"sortablejs": "1\.15\.7"/)
  assert.match(runtime, /import Sortable from 'sortablejs'/)
  assert.match(runtime, /Sortable\.create\(list/)
  assert.match(runtime, /const LONG_PRESS_MS = 300/)
  assert.match(runtime, /const TOUCH_START_THRESHOLD_PX = 7/)
  assert.match(runtime, /delay: LONG_PRESS_MS/)
  assert.match(runtime, /delayOnTouchOnly: true/)
  assert.match(runtime, /touchStartThreshold: TOUCH_START_THRESHOLD_PX/)
  assert.doesNotMatch(runtime, /supportPointer:\s*false/)
  assert.match(css, /touch-action: pan-y !important/)
  assert.doesNotMatch(runtime, /setPointerCapture|scrollTop -=/)
})

test('toda la fila es superficie de drag y los controles reales quedan excluidos', () => {
  assert.match(runtime, /handle: '\.note-row\[data-reorder-note-id\]'/)
  assert.match(runtime, /function isExcludedInteractiveTarget/)
  assert.match(runtime, /\.note-row__menu-wrap/)
  assert.match(runtime, /button:not\(\.note-row__open\)/)
  assert.match(runtime, /interactionBlocked\(\) \|\| isExcludedInteractiveTarget\(target\)/)
  assert.match(workspace, /className="note-row__open"/)
  assert.match(workspace, /NoteAvatar[\s\S]*?className="note-row__avatar"/)
  assert.match(avatar, /className=\{className\}/)
  assert.match(css, /\.note-row\[data-reorder-note-id\],\s*\n\.note-row\[data-reorder-note-id\] \.note-row__open/)
  assert.match(css, /cursor:\s*grab/)
  assert.match(css, /@media \(pointer: coarse\)[\s\S]*?touch-action:\s*pan-y !important/)
  assert.doesNotMatch(runtime, /touchArmTimer|touchArmed/)
})

test('instrumentación temporal de drag fue retirada después del diagnóstico', () => {
  assert.doesNotMatch(runtime, /__OANIX_NOTE_DRAG_TRACE__/)
  assert.doesNotMatch(runtime, /Drag logs/)
  assert.doesNotMatch(runtime, /onPointerMoveDiagnostic|onTouchMoveDiagnostic/)
})

test('la tarjeta visible es el fallback de Sortable y sigue directamente el dedo', () => {
  assert.match(runtime, /forceFallback: true/)
  assert.match(runtime, /fallbackOnBody: true/)
  assert.match(runtime, /fallbackTolerance: 4/)
  assert.match(runtime, /fallbackClass: 'oanix-mobile-note-drag-ghost'/)
  assert.match(runtime, /ghostClass: 'oanix-mobile-note-placeholder'/)
  assert.doesNotMatch(runtime, /cloneNode\(true\)|dragOverlay|latestDragPoint|requestAnimationFrame\(positionDragOverlay\)/)
  assert.doesNotMatch(runtime, /document\.addEventListener\('pointermove'|document\.addEventListener\('touchmove'/)
  assert.match(css, /\.note-row\.oanix-mobile-note-drag-ghost[\s\S]*?z-index:\s*9900 !important/)
  assert.match(css, /\.note-row\.oanix-mobile-note-drag-ghost[\s\S]*?opacity:\s*\.99 !important/)
  assert.match(css, /\.note-row\.oanix-mobile-note-drag-ghost[\s\S]*?will-change:\s*transform/)
  assert.doesNotMatch(css, /\.oanix-note-drag-overlay|oanix-note-floating-active/)
  assert.match(css, /\.note-row\.oanix-mobile-note-placeholder[\s\S]*?border:\s*2px dashed/)
  assert.match(css, /\.note-row\.oanix-mobile-note-placeholder > \*[\s\S]*?visibility:\s*hidden !important/)
  assert.match(css, /@keyframes oanix-note-drop-slot-pulse/)
})

test('el fallback que sigue el dedo gana al placeholder y mantiene visible todo el contenido', () => {
  assert.match(css, /body > \.note-row\.oanix-mobile-note-drag-ghost\s*\{[\s\S]*background:\s*var\(--oanix-note-drag-background\) !important/)
  assert.match(css, /body > \.note-row\.oanix-mobile-note-drag-ghost > \*\s*\{[\s\S]*visibility:\s*visible !important[\s\S]*opacity:\s*1 !important/)
  assert.match(css, /body > \.note-row\.oanix-mobile-note-drag-ghost::after\s*\{[\s\S]*opacity:\s*1 !important/)
  assert.match(css, /body > \.note-row\.oanix-mobile-note-drag-ghost \.note-row__avatar[\s\S]*visibility:\s*visible !important/)
})

test('identidad visual se congela por note id durante el drag y se restaura antes de persistir', () => {
  assert.match(runtime, /const dragIdentityById = new Map<string, DragIdentity>\(\)/)
  assert.match(runtime, /freezeDragIdentity\(\)/)
  assert.match(runtime, /restoreDragIdentity\(\)/)
  assert.match(runtime, /--oanix-note-drag-stable-card-color/)
  assert.match(runtime, /--oanix-note-drag-stable-tab-color/)
  assert.match(runtime, /avatar\.dataset\.oanixNoteIcon = identity\.icon/)
  assert.match(css, /\.note-row\[data-oanix-note-stable-visual='true'\][\s\S]*--oanix-note-card-color:\s*var\(--oanix-note-stable-color\) !important/)
  assert.match(css, /\.note-row\[data-oanix-note-stable-visual='true'\][\s\S]*--oanix-note-tab-color:\s*var\(--oanix-note-stable-color\) !important/)
  assert.match(css, /--oanix-note-card-color:\s*var\(--oanix-note-drag-stable-card-color\) !important/)
  assert.match(css, /--oanix-note-tab-color:\s*var\(--oanix-note-drag-stable-tab-color\) !important/)
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
  assert.match(runtime, /function isExcludedInteractiveTarget/)
  assert.match(runtime, /interactionBlocked\(\) \|\| isExcludedInteractiveTarget\(target\)/)
  assert.match(runtime, /preventOnFilter: false/)
  assert.match(runtime, /oanix-note-bulk-selecting/)
  assert.match(privacyRuntime, /data-oanix-bulk-mode/)
})

test('orden persiste y sincroniza React sin remonte completo en el camino exitoso', () => {
  assert.match(runtime, /onEnd:/)
  assert.match(runtime, /const nextOrder = noteOrder\(event\.to\)/)
  assert.match(runtime, /const updatedNotes = await persistNoteOrder\(nextOrder\)/)
  assert.match(runtime, /oanix:note-order-persisted/)
  assert.match(runtime, /manualOrder: note\.manualOrder/)
  assert.match(workspace, /oanix:note-order-persisted/)
  assert.match(workspace, /manualOrderById/)
  assert.match(workspace, /\.sort\(compareNotesForList\)/)
  assert.doesNotMatch(runtime, /persistNoteOrder\(nextOrder\)[\s\S]{0,500}oanix:workspace-refresh/)
  assert.match(runtime, /catch \{[\s\S]{0,160}oanix:workspace-refresh/)
  assert.doesNotMatch(runtime, /persistNoteOrder[\s\S]{0,120}onMove/)
})

test('dock de carpetas queda inmóvil e inerte mientras se arrastra una nota', () => {
  assert.match(css, /html\.oanix-mobile-note-dragging,\s*\nbody\.oanix-mobile-note-dragging\s*\{[\s\S]*?overflow:\s*hidden !important/)
  assert.match(css, /html\.oanix-mobile-note-dragging \.oanix-folder-grid/)
  assert.match(css, /position:\s*fixed !important/)
  assert.match(css, /inset:\s*auto 0 0 !important/)
  assert.match(css, /pointer-events:\s*none !important/)
  assert.match(css, /html\.oanix-mobile-note-dragging \.oanix-folder-rail/)
  assert.match(css, /transition:\s*none !important/)
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
  assert.match(runtime, /sortable\.destroy\(\)/)
  assert.doesNotMatch(runtime, /new MutationObserver/)
  assert.match(app, /<NoteListReorderGestureRuntime key=\{`note-reorder-\$\{workspaceRevision\}`\} \/>/)
})
