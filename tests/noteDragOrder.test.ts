import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('note ordering is owned by the SortableJS long-press runtime', () => {
  const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
  const runtime = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')

  assert.match(workspace, /data-reorder-note-id=\{note\.id\}/)
  assert.doesNotMatch(workspace, /handleReorderPointerDown|handleReorderPointerMove|handleReorderPointerEnd|handleReorderPointerCancel/)
  assert.doesNotMatch(workspace, /setPointerCapture|document\.elementFromPoint|touchAction: 'none'|⠿/)
  assert.match(runtime, /import Sortable from 'sortablejs'/)
  assert.match(runtime, /Sortable\.create\(list/)
  assert.match(runtime, /handle:\s*'\.note-row\[data-reorder-note-id\]'/)
  assert.match(runtime, /button:not\(\.note-row__open\)/)
  assert.match(runtime, /forceFallback: true/)
  assert.match(runtime, /delayOnTouchOnly: true/)
  assert.match(runtime, /persistNoteOrder\(orderToPersist, \(\) => !disposed && pendingPersistOrder === null\)/)
  assert.match(runtime, /oanix:note-order-preview/)
  assert.match(workspace, /oanix:note-order-preview/)
  assert.doesNotMatch(workspace, /aria-label=\{`Mover \$\{note\.title\} arriba`\}/)
  assert.doesNotMatch(workspace, /aria-label=\{`Mover \$\{note\.title\} abajo`\}/)
})

test('the visual note avatar remains passive and touch-safe inside full-row dragging', () => {
  const gestureCss = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')
  const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
  const avatar = readFileSync('src/features/notes/NoteAvatar.tsx', 'utf8')

  assert.match(workspace, /NoteAvatar[\s\S]*?className="note-row__avatar"/)
  assert.match(avatar, /className=\{className\}/)
  assert.match(gestureCss, /\.note-row\[data-reorder-note-id\] \.note-row__avatar,[\s\S]*?html\.oanix-v383-visual \.note-row\[data-reorder-note-id\] \.note-row__avatar\s*\{[\s\S]*?pointer-events:\s*auto !important;[\s\S]*?touch-action:\s*none !important/)
  assert.doesNotMatch(gestureCss, /data-oanix-note-icon/)
})

test('direct drag still uses the existing encrypted note order and no parallel persistence', () => {
  const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
  const runtime = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
  const service = readFileSync('src/features/notes/noteService.ts', 'utf8')

  assert.match(runtime, /persistNoteOrder/)
  assert.match(service, /manualOrder/)
  assert.doesNotMatch(workspace, /persistNoteOrder/)
  assert.doesNotMatch(runtime, /localStorage|sessionStorage|indexedDB|caches\.open/)
})
