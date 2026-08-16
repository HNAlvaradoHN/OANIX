import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('manual note ordering uses pointer drag instead of arrow-only controls', () => {
  const source = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')

  assert.match(source, /onPointerDown=\{\(event\) => handleReorderPointerDown/)
  assert.match(source, /onPointerMove=\{\(event\) => handleReorderPointerMove/)
  assert.match(source, /onPointerUp=\{\(event\) => handleReorderPointerEnd/)
  assert.match(source, /onPointerCancel=\{\(event\) => handleReorderPointerCancel/)
  assert.match(source, /setPointerCapture\(event\.pointerId\)/)
  assert.match(source, /document\.elementFromPoint/)
  assert.match(source, /persistNoteOrder\(nextOrder\.map\(\(note\) => note\.id\)\)/)
  assert.match(source, /touchAction: 'none'/)
  assert.match(source, /⠿/)
  assert.doesNotMatch(source, /aria-label=\{`Mover \$\{note\.title\} arriba`\}/)
  assert.doesNotMatch(source, /aria-label=\{`Mover \$\{note\.title\} abajo`\}/)
})

test('drag ordering still uses the existing encrypted note order and no parallel persistence', () => {
  const source = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
  const service = readFileSync('src/features/notes/noteService.ts', 'utf8')

  assert.match(source, /persistNoteOrder/)
  assert.match(service, /manualOrder/)
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|caches\.open/)
})
