import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const appSource = readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8')
const runtimeSource = readFileSync(new URL('../src/features/attachments/NoteAttachmentsRuntime.tsx', import.meta.url), 'utf8')
const exportSource = readFileSync(new URL('../src/features/attachments/largeAttachmentExportService.ts', import.meta.url), 'utf8')
const driveSource = readFileSync(new URL('../src/features/attachments/largeAttachmentDriveService.ts', import.meta.url), 'utf8')
const providerSource = readFileSync(new URL('../src/features/largeObjects/googleDriveStorageProvider.ts', import.meta.url), 'utf8')
const contractSource = readFileSync(new URL('../src/features/largeObjects/largeObjectTransferContract.ts', import.meta.url), 'utf8')

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

test('remote attachment cards identify Drive storage and enable progressive open/export', () => {
  assert.match(runtimeSource, /Drive · cifrado por fragmentos/)
  assert.match(runtimeSource, /exportRemoteLargeAttachment/)
  assert.match(runtimeSource, /Recuperando.*Drive/u)
  assert.match(runtimeSource, /Exportando.*Drive/u)
  assert.match(runtimeSource, /backup conserva referencia y manifiestos cifrados, no el contenido remoto/)
  assert.doesNotMatch(runtimeSource, /disabled=\{busy \|\| remote\}/)
})

test('large remote recovery decrypts Drive ranges chunk-by-chunk instead of building a 1 GiB buffer', () => {
  assert.match(driveSource, /downloadCiphertextRange/)
  assert.match(driveSource, /decryptLargeObjectChunk/)
  assert.match(driveSource, /consumePlaintextChunk/)
  assert.match(driveSource, /ciphertext\?\.fill\(0\)/)
  assert.match(driveSource, /plaintext\?\.fill\(0\)/)
  assert.match(exportSource, /beginAndroidBinaryFileSave/)
  assert.match(exportSource, /writeAndroidBinaryFileChunk/)
  assert.match(exportSource, /showSaveFilePicker/)
  assert.match(exportSource, /FALLBACK_BLOB_LIMIT_BYTES/)
})

test('remote recovery can be cancelled all the way down to the Drive fetch', () => {
  assert.match(runtimeSource, /new AbortController\(\)/)
  assert.match(runtimeSource, /Cancelar/)
  assert.match(runtimeSource, /controller\.abort\(\)/)
  assert.match(exportSource, /signal\?: AbortSignal/)
  assert.match(driveSource, /signal\?: AbortSignal/)
  assert.match(contractSource, /signal\?: AbortSignal/)
  assert.match(providerSource, /signal: request\.signal/)
})

test('recovery exposes useful progress and waits for connectivity to return', () => {
  assert.match(runtimeSource, /formatAttachmentSize\(recoveredPlaintextBytes\)/)
  assert.match(runtimeSource, /formatAttachmentSize\(Math\.round\(bytesPerSecond\)\)/)
  assert.match(runtimeSource, /formatEta/)
  assert.match(runtimeSource, /Sin conexión · esperando red/)
  assert.match(driveSource, /navigator\.onLine/)
  assert.match(driveSource, /waitUntilOnline/)
})

test('successful attachment notices are transient rather than requiring manual dismissal', () => {
  assert.match(runtimeSource, /showTransientStatus/)
  assert.match(runtimeSource, /milliseconds = 2000/)
  assert.match(runtimeSource, /Archivo recuperado y guardado\./)
})
