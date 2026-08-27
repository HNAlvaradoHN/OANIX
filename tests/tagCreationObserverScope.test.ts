import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const organic = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const notesWorkspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')

test('tag plus actions are owned by the organic workspace without a second click-capture runtime', () => {
  assert.doesNotMatch(gate, /TagCreationRuntime/)
  assert.match(organic, /onClick=\{\(\) => setTagActionMenuOpen\(\(open\) => !open\)\}/)
  assert.match(organic, />\s*Agregar etiqueta\s*</)
  assert.match(organic, />\s*Eliminar etiqueta\s*</)
  assert.doesNotMatch(organic, /document\.addEventListener\('click', handleClickCapture, true\)/)
})

test('tag creation persists icon and color directly and decorates chips from state', () => {
  assert.match(organic, /createTag\(normalized, \{ icon: tagIcon, color: tagColor \}\)/)
  assert.match(organic, /data-oanix-tag-icon=\{tag\.icon \|\| DEFAULT_TAG_ICON\}/)
  assert.match(organic, /--oanix-tag-color/)
})

test('delete action reuses the existing encrypted tag manager and delete handler', () => {
  assert.match(organic, /button\[aria-label="Administrar etiquetas"\]/)
  assert.match(notesWorkspace, /async function handleDeleteTag\(tag: TagRecord\)/)
  assert.match(notesWorkspace, /await deleteTag\(tag\.id\)/)
  assert.match(notesWorkspace, /onClick=\{\(\) => void handleDeleteTag\(tag\)\}/)
})
