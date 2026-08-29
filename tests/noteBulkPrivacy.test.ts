import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/privacy/NoteBulkPrivacyRuntime.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const theme = readFileSync('src/features/notes/themes/infographic/InfographicWorkspace.tsx', 'utf8')

test('new notes keep the isolated privacy refresh bridge', () => {
  assert.match(runtime, /NOTE_PRIVACY_REFRESH_EVENT = 'oanix:note-privacy-refresh'/)
  assert.match(runtime, /knownRowIdsRef/)
  assert.match(runtime, /foundNewNote/)
  assert.match(runtime, /dispatchPrivacyRefresh\(\)/)
  assert.match(app, /privacyRevision/)
  assert.match(app, /NOTE_PRIVACY_REFRESH_EVENT/)
  assert.match(app, /privacy-\$\{workspaceRevision\}-\$\{privacyRevision\}/)
})

test('the active create-note button now calls the real create handler directly', () => {
  assert.match(theme, /className="notes-create-fab fab-add-note"/)
  assert.match(theme, /onClick=\{onCreateNote\}/)
  assert.match(theme, /aria-label=\{creating \? 'Creando nota' : 'Crear nueva nota'\}/)
  assert.doesNotMatch(runtime, /\.notes-create-fab/)
  assert.doesNotMatch(runtime, /Agregar nota|Marcar notas|Crear o marcar notas/)
  assert.doesNotMatch(runtime, /createPortal|data-oanix-bulk-mode|oanix-note-picker-sheet/)
})

test('bulk selection UI and bulk deletion are retired from the active runtime', () => {
  assert.doesNotMatch(runtime, /selectionMode|selectedIds|beginSelection|continueSelection/)
  assert.doesNotMatch(runtime, /Aplicar código|Borrar|Cancelar selección/)
  assert.doesNotMatch(runtime, /deleteNote|deleteEncryptedImage|createNotePrivacyLock/)
  assert.doesNotMatch(runtime, /noteBulkPrivacy\.css/)
})

test('individual privacy remains under NotePrivacyRuntime', () => {
  assert.match(app, /<NotePrivacyRuntime/)
  assert.match(theme, /oanix:open-note-privacy/)
  assert.match(theme, /aria-label="Privacidad de la nota"/)
})
