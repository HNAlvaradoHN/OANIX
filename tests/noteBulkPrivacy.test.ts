import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/privacy/NoteBulkPrivacyRuntime.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')

test('las notas nuevas fuerzan refresco aislado del runtime de privacidad', () => {
  assert.match(runtime, /NOTE_PRIVACY_REFRESH_EVENT = 'oanix:note-privacy-refresh'/)
  assert.match(runtime, /knownRowIdsRef/)
  assert.match(runtime, /foundNewNote/)
  assert.match(runtime, /dispatchPrivacyRefresh\(\)/)
  assert.match(app, /privacyRevision/)
  assert.match(app, /NOTE_PRIVACY_REFRESH_EVENT/)
  assert.match(app, /privacy-\$\{workspaceRevision\}-\$\{privacyRevision\}/)
  assert.doesNotMatch(app, /setWorkspaceRevision\(\(value\) => value \+ 1\).*NOTE_PRIVACY_REFRESH_EVENT/s)
})

test('pulsación prolongada quieta entra en selección múltiple sin competir con el arrastre', () => {
  assert.match(runtime, /LONG_PRESS_MS = 760/)
  assert.match(runtime, /pointerdown/)
  assert.match(runtime, /pointermove/)
  assert.match(runtime, /data-oanix-note-drag-active/)
  assert.match(runtime, /oanix:note-bulk-selection-start/)
  assert.match(runtime, /suppressNextClickRef/)
  assert.match(runtime, /selectedIdsRef\.current\.size > 0/)
  assert.match(runtime, /oanix-note-bulk-selecting/)
})

test('protección múltiple conserva códigos existentes y crea un verificador independiente por nota', () => {
  assert.match(runtime, /alreadyProtected/)
  assert.match(runtime, /filter\(\(noteId\) => !alreadyProtected\.has\(noteId\)\)/)
  assert.match(runtime, /for \(let index = 0; index < targets\.length; index \+= 1\)/)
  assert.match(runtime, /const lock = await createNotePrivacyLock\(code\)/)
  assert.match(runtime, /await setNotePrivacyLock\(targets\[index\], lock\)/)
  assert.match(runtime, /Las que ya tengan código conservarán el suyo/)
})

test('desbloqueo individual existente no se sustituye por un desbloqueo grupal', () => {
  assert.doesNotMatch(runtime, /verifyNotePrivacyLock/)
  assert.doesNotMatch(runtime, /unlockedNoteIds/)
  assert.match(app, /<NotePrivacyRuntime/)
})
