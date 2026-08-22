import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const appSource = readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8')
const runtimeSource = readFileSync(new URL('../src/features/attachments/NoteAttachmentsRuntime.tsx', import.meta.url), 'utf8')

test('note attachments runtime is mounted only inside the unlocked application tree', () => {
  assert.match(appSource, /import \{ NoteAttachmentsRuntime \}/)
  assert.match(appSource, /<NotesWorkspace[^>]*\/>[\s\S]*<NoteAttachmentsRuntime/)
  assert.doesNotMatch(appSource.split('export function App()')[1] ?? '', /<NoteAttachmentsRuntime/)
})

test('normal attachment picker routes files above the local threshold through the large-object service', () => {
  assert.match(runtimeSource, /file\.size > MAX_LOCAL_ATTACHMENT_BYTES/)
  assert.match(runtimeSource, /storeEncryptedAttachment\(noteId, file\)/)
  assert.match(runtimeSource, /Cifrando y subiendo archivo/)
})

test('remote attachment cards identify Drive storage and do not rebuild large files in memory', () => {
  assert.match(runtimeSource, /Drive · cifrado por fragmentos/)
  assert.match(runtimeSource, /disabled=\{busy \|\| remote\}/)
  assert.match(runtimeSource, /recuperación cifrada por rangos desde Drive/)
  assert.match(runtimeSource, /backup conserva referencia y manifiestos cifrados, no el contenido remoto/)
})
