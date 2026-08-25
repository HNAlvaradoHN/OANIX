import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('note ordering is owned by the direct long-press drag runtime', () => {
  const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
  const runtime = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')

  assert.match(workspace, /data-reorder-note-id=\{note\.id\}/)
  assert.doesNotMatch(workspace, /handleReorderPointerDown|handleReorderPointerMove|handleReorderPointerEnd|handleReorderPointerCancel/)
  assert.doesNotMatch(workspace, /setPointerCapture|document\.elementFromPoint|touchAction: 'none'|⠿/)
  assert.match(runtime, /setPointerCapture\(gesture\.pointerId\)/)
  assert.match(runtime, /createGhost/)
  assert.match(runtime, /previewOrderAtPoint/)
  assert.match(runtime, /persistNoteOrder\(nextOrder\)/)
  assert.doesNotMatch(workspace, /aria-label=\{`Mover \$\{note\.title\} arriba`\}/)
  assert.doesNotMatch(workspace, /aria-label=\{`Mover \$\{note\.title\} abajo`\}/)
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
