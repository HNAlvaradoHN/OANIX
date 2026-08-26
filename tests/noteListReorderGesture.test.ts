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

test('reorder móvil usa SortableJS y conserva scroll nativo fuera del handle', () => {
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

test('avatar es el handle táctil y el contrato funcional gobierna su interacción', () => {
  assert.match(runtime, /handle: '\.note-row__avatar'/)
  assert.match(runtime, /function isDragHandle/)
  assert.match(runtime, /target\.closest\('\.note-row__avatar'\)/)
  assert.match(runtime, /!isDragHandle\(target\) && isInteractiveTarget\(target\)/)
  assert.match(workspace, /NoteAvatar[\s\S]*?className="note-row__avatar"/)
  assert.match(avatar, /className=\{className\}/)
  assert.match(css, /\.note-row\[data-reorder-note-id\] \.note-row__avatar,[\s\S]*?html\.oanix-v383-visual \.note-row\[data-reorder-note-id\] \.note-row__avatar\s*\{[\s\S]*?pointer-events:\s*auto !important;[\s\S]*?touch-action:\s*none !important/)
  assert.doesNotMatch(css, /data-oanix-note-icon/)
  assert.doesNotMatch(runtime, /touchArmTimer|touchArmed|function onTouchMove/)
})

test('diagnóstico temporal de drag observa eventos sin convertirse en otro motor', () => {
  assert.match(runtime, /document\.addEventListener\('pointermove', onPointerMoveDiagnostic, true\)/)
  assert.match(runtime, /document\.addEventListener\('pointercancel', onPointerCancelDiagnostic, true\)/)
  assert.match(runtime, /document\.addEventListener\('touchmove', onTouchMoveDiagnostic, true\)/)
  assert.match(runtime, /document\.addEventListener\('touchcancel', onTouchCancelDiagnostic, true\)/)
  assert.match(runtime, /document\.removeEventListener\('pointermove', onPointerMoveDiagnostic, true\)/)
  assert.match(runtime, /document\.removeEventListener\('pointercancel', onPointerCancelDiagnostic, true\)/)
  assert.match(runtime, /document\.removeEventListener\('touchmove', onTouchMoveDiagnostic, true\)/)
  assert.match(runtime, /document\.removeEventListener\('touchcancel', onTouchCancelDiagnostic, true\)/)
  assert.match(runtime, /if \(!dragDiagnosticActive\) return/)
  assert.doesNotMatch(runtime, /setPointerCapture|releasePointerCapture|elementFromPoint|scrollTop -=/)
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
  assert.match(runtime, /function isInteractiveTarget/)
  assert.match(runtime, /interactionBlocked\(\) \|\| \(!isDragHandle\(target\) && isInteractiveTarget\(target\)\)/)
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
