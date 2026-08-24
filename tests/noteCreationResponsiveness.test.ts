import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const service = readFileSync('src/features/notes/noteService.ts', 'utf8')
const runtime = readFileSync('src/features/notes/NoteCreationFeedbackRuntime.tsx', 'utf8')
const styles = readFileSync('src/features/notes/noteCreationFeedback.css', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

test('note creation reuses the manual-order snapshot loaded with the workspace', () => {
  assert.match(service, /let manualOrderSnapshot: ManualOrderSnapshot \| null = null/)
  assert.match(service, /export async function loadNotes\(\)[\s\S]*manualOrderSnapshot = buildManualOrderSnapshot\(notes\)/)
  assert.match(service, /if \(!manualOrderSnapshot\) \{[\s\S]*await listNotes\(\)/)
  assert.match(service, /await saveNote\(note\)[\s\S]*manualOrderSnapshot = \{ canContinue: true, highest: nextManualOrder \}/)
})

test('note creation has immediate blocking feedback from the first click', () => {
  assert.match(runtime, /document\.addEventListener\('click', onClick, true\)/)
  assert.match(runtime, /title\.textContent = 'Creando nota…'/)
  assert.match(runtime, /detail\.textContent = 'Preparando y guardando la nueva nota cifrada'/)
  assert.match(styles, /#oanix-note-create-feedback[\s\S]*position: fixed/)
  assert.match(styles, /#oanix-note-create-feedback[\s\S]*pointer-events: auto/)
  assert.match(gate, /<NoteCreationFeedbackRuntime \/>/)
})
