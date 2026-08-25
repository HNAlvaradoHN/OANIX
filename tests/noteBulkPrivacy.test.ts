import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/privacy/NoteBulkPrivacyRuntime.tsx', 'utf8')
const css = readFileSync('src/features/privacy/noteBulkPrivacy.css', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')

test('las notas nuevas mantienen el refresco aislado del runtime de privacidad', () => {
  assert.match(runtime, /NOTE_PRIVACY_REFRESH_EVENT = 'oanix:note-privacy-refresh'/)
  assert.match(runtime, /knownRowIdsRef/)
  assert.match(runtime, /foundNewNote/)
  assert.match(runtime, /dispatchPrivacyRefresh\(\)/)
  assert.match(app, /privacyRevision/)
  assert.match(app, /NOTE_PRIVACY_REFRESH_EVENT/)
  assert.match(app, /privacy-\$\{workspaceRevision\}-\$\{privacyRevision\}/)
})

test('el botón crear abre agregar o marcar y se transforma en terminar durante selección', () => {
  assert.match(runtime, /\.notes-create-fab/)
  assert.match(runtime, /Agregar nota/)
  assert.match(runtime, /Marcar notas/)
  assert.match(runtime, /data-oanix-bulk-mode/)
  assert.match(runtime, /Terminar de marcar/)
  assert.match(css, /\.notes-create-fab\[data-oanix-bulk-mode\]/)
  assert.doesNotMatch(runtime, /LONG_PRESS_MS|pointerdown|pointermove|suppressNextClickRef/)
})

test('terminar selección ofrece aplicar código, borrar o cancelar sin barra inferior', () => {
  assert.match(runtime, /Aplicar código/)
  assert.match(runtime, /Borrar/)
  assert.match(runtime, /Cancelar selección/)
  assert.doesNotMatch(runtime, /oanix-note-bulk-bar/)
  assert.doesNotMatch(css, /\.oanix-note-bulk-bar/)
})

test('protección múltiple conserva códigos existentes y crea un verificador independiente por nota', () => {
  assert.match(runtime, /alreadyProtected/)
  assert.match(runtime, /filter\(\(noteId\) => !alreadyProtected\.has\(noteId\)\)/)
  assert.match(runtime, /for \(let index = 0; index < targets\.length; index \+= 1\)/)
  assert.match(runtime, /const lock = await createNotePrivacyLock\(code\)/)
  assert.match(runtime, /await setNotePrivacyLock\(targets\[index\], lock\)/)
  assert.match(runtime, /Las que ya tengan código conservarán el suyo/)
})

test('borrado múltiple elimina notas e imágenes y refresca el workspace autoritativo', () => {
  assert.match(runtime, /await deleteNote\(ids\[index\]\)/)
  assert.match(runtime, /deleteEncryptedImage/)
  assert.match(runtime, /oanix:local-data-changed/)
  assert.match(runtime, /oanix:workspace-refresh/)
  assert.match(app, /window\.addEventListener\('oanix:workspace-refresh'/)
})

test('desbloqueo individual existente no se sustituye por un desbloqueo grupal', () => {
  assert.doesNotMatch(runtime, /verifyNotePrivacyLock/)
  assert.doesNotMatch(runtime, /unlockedNoteIds/)
  assert.match(app, /<NotePrivacyRuntime/)
})
