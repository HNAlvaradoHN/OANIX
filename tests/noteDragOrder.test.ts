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
  assert.match(runtime, /handle:\s*'\.note-row__avatar'/)
  assert.match(runtime, /forceFallback: true/)
  assert.match(runtime, /delayOnTouchOnly: true/)
  assert.match(runtime, /persistNoteOrder\(nextOrder\)/)
  assert.doesNotMatch(workspace, /aria-label=\{`Mover \$\{note\.title\} arriba`\}/)
  assert.doesNotMatch(workspace, /aria-label=\{`Mover \$\{note\.title\} abajo`\}/)
})

test('the visual note avatar remains a real coarse-pointer drag handle', () => {
  const gestureCss = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')
  const visualCss = readFileSync('src/features/notes/v383WorkspaceVisual.css', 'utf8')

  assert.match(visualCss, /\.note-row__avatar\[data-oanix-note-icon\][\s\S]*?pointer-events:\s*none !important/)
  assert.match(gestureCss, /html\.oanix-v383-visual[\s\S]*?\.note-row\[data-reorder-note-id\][\s\S]*?\.note-row__avatar\[data-oanix-note-icon\][\s\S]*?pointer-events:\s*auto !important/)
  assert.match(gestureCss, /\.note-row__avatar\[data-oanix-note-icon\][\s\S]*?touch-action:\s*none !important/)
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
