import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/NoteVisualIdentityRuntime.tsx', 'utf8')
const personalization = readFileSync('src/features/notes/WorkspacePersonalizationRuntime.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')

test('fallback visual de nota es estable por id y no por indice DOM', () => {
  assert.match(runtime, /function fallbackColorForNote\(noteId: string\)/)
  assert.match(runtime, /noteId\.charCodeAt\(index\)/)
  assert.match(runtime, /hash >>> 0/)
  assert.match(runtime, /NOTE_VISUAL_COLORS/)
  assert.doesNotMatch(runtime, /forEach\(\(row, index\)/)
  assert.doesNotMatch(runtime, /NOTE_VISUAL_COLORS\[index/)
})

test('color e icono se reaplican solo dentro de notes-list sin observar estilos por cada mutacion', () => {
  assert.match(runtime, /const noteList = document\.querySelector<HTMLElement>\('\.notes-list'\)/)
  assert.match(runtime, /noteList\?\.querySelectorAll<HTMLElement>\(':scope > \.note-row\[data-reorder-note-id\]'\)/)
  assert.doesNotMatch(runtime, /document\.querySelectorAll<HTMLElement>\('\.note-row\[data-reorder-note-id\]'\)/)
  assert.match(runtime, /notesById\.get\(noteId\)/)
  assert.match(runtime, /--oanix-note-card-color/)
  assert.match(runtime, /--oanix-note-tab-color/)
  assert.match(runtime, /avatar\.dataset\.oanixNoteIcon/)
  assert.match(runtime, /observer = new MutationObserver\(scheduleApply\)/)
  assert.match(runtime, /observer\?\.disconnect\(\)/)
  assert.match(runtime, /childList:\s*true/)
  assert.match(runtime, /subtree:\s*true/)
  assert.doesNotMatch(runtime, /attributes:\s*true/)
  assert.doesNotMatch(runtime, /attributeFilter:/)
  assert.match(runtime, /noteDragActive\(\)/)
})

test('personalizacion manual actualiza la identidad autoritativa antes de redecorar', () => {
  assert.match(personalization, /oanix:note-visual-changed/)
  assert.match(personalization, /detail: \{ note: updated \}/)
  assert.match(runtime, /oanix:note-visual-changed/)
  assert.match(runtime, /notesById\.set\(note\.id, note\)/)
})

test('workspace personalization no compite con la autoridad visual de notas', () => {
  assert.doesNotMatch(personalization, /row\.style\.setProperty\('--oanix-note-card-color'/)
  assert.doesNotMatch(personalization, /row\.style\.setProperty\('--oanix-note-tab-color'/)
  assert.doesNotMatch(personalization, /avatar\.dataset\.oanixNoteIcon\s*=/)
  assert.match(personalization, /row\.dataset\.oanixNoteCategory = category/)
  assert.match(personalization, /preview\.dataset\.oanixNoteDescription/)
})

test('capa autoritativa monta despues de los dos decoradores existentes', () => {
  const organicIndex = legacyGate.indexOf('<OrganicWorkspaceRuntime />')
  const personalizationIndex = legacyGate.indexOf('<WorkspacePersonalizationRuntime />')
  const identityIndex = legacyGate.indexOf('<NoteVisualIdentityRuntime />')
  assert.ok(organicIndex >= 0)
  assert.ok(personalizationIndex > organicIndex)
  assert.ok(identityIndex > personalizationIndex)
})
