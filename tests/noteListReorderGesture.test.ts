import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')
const privacyRuntime = readFileSync('src/features/privacy/NoteBulkPrivacyRuntime.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')

test('el gesto de ordenar se limita al avatar y no reemplaza la pulsación larga de privacidad en el cuerpo', () => {
  assert.match(runtime, /target\.closest<HTMLElement>\('\.note-row__avatar'\)/)
  assert.match(runtime, /event\.stopImmediatePropagation\(\)/)
  assert.match(privacyRuntime, /target\.closest<HTMLButtonElement>\('\.note-row__open'\)/)
  assert.match(privacyRuntime, /const LONG_PRESS_MS = 520/)
})

test('el botón superior de ordenar desaparece pero se reutiliza el motor manual existente', () => {
  assert.match(runtime, /Ordenar notas manualmente/)
  assert.match(runtime, /Terminar de ordenar notas/)
  assert.match(css, /button\[aria-label="Ordenar notas manualmente"\]/)
  assert.match(css, /display: none !important/)
})

test('el modo de orden mueve la fila completa, vibra suavemente y conserva tres puntos', () => {
  assert.match(css, /oanix-note-jiggle/)
  assert.match(css, /aria-label\^="Orden manual de /)
  assert.match(runtime, /oanix-note-reorder-menu-proxy/)
  assert.match(runtime, /menu\.textContent = '⋮'/)
  assert.match(runtime, /navigator\.vibrate\?\.\(16\)/)
  assert.match(css, /prefers-reduced-motion: reduce/)
})

test('el runtime de gesto solo vive durante la sesión desbloqueada', () => {
  assert.match(app, /<NoteListReorderGestureRuntime key=\{`note-reorder-\$\{workspaceRevision\}`\} \/>/)
})
