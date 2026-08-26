import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/NoteVisualIdentityRuntime.tsx', 'utf8')
const personalization = readFileSync('src/features/notes/WorkspacePersonalizationRuntime.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

test('fallback visual de nota es estable por id y no por indice DOM', () => {
  assert.match(runtime, /function fallbackColorForNote\(noteId: string\)/)
  assert.match(runtime, /noteId\.charCodeAt\(index\)/)
  assert.match(runtime, /hash >>> 0/)
  assert.match(runtime, /NOTE_VISUAL_COLORS/)
  assert.doesNotMatch(runtime, /forEach\(\(row, index\)/)
  assert.doesNotMatch(runtime, /NOTE_VISUAL_COLORS\[index/)
})

test('color e icono se reaplican por data-reorder-note-id despues de mutaciones', () => {
  assert.match(runtime, /\.note-row\[data-reorder-note-id\]/)
  assert.match(runtime, /notesById\.get\(noteId\)/)
  assert.match(runtime, /--oanix-note-card-color/)
  assert.match(runtime, /--oanix-note-tab-color/)
  assert.match(runtime, /avatar\.dataset\.oanixNoteIcon/)
  assert.match(runtime, /new MutationObserver\(scheduleApply\)/)
  assert.match(runtime, /attributeFilter: \['style', 'data-oanix-note-icon'\]/)
})

test('personalizacion manual actualiza la identidad autoritativa antes de redecorar', () => {
  assert.match(personalization, /oanix:note-visual-changed/)
  assert.match(personalization, /detail: \{ note: updated \}/)
  assert.match(runtime, /oanix:note-visual-changed/)
  assert.match(runtime, /notesById\.set\(note\.id, note\)/)
})

test('capa autoritativa monta despues de los dos decoradores existentes', () => {
  const organicIndex = gate.indexOf('<OrganicWorkspaceRuntime />')
  const personalizationIndex = gate.indexOf('<WorkspacePersonalizationRuntime />')
  const identityIndex = gate.indexOf('<NoteVisualIdentityRuntime />')
  assert.ok(organicIndex >= 0)
  assert.ok(personalizationIndex > organicIndex)
  assert.ok(identityIndex > personalizationIndex)
})
