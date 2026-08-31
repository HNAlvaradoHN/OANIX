import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const app = readFileSync('src/app/App.tsx', 'utf8')
const database = readFileSync('src/storage/local/database.ts', 'utf8')
const repository = readFileSync('src/storage/repositories/encryptedV2RecordRepository.ts', 'utf8')
const service = readFileSync('src/features/rebuild/rebuildService.ts', 'utf8')
const model = readFileSync('src/features/rebuild/rebuildModel.ts', 'utf8')
const rebuild = readFileSync('src/features/rebuild/RebuildApp.tsx', 'utf8')
const css = readFileSync('src/features/rebuild/rebuild.css', 'utf8')

test('post-unlock rebuild keeps the vault gate and replaces the old workspace authority', () => {
  assert.match(app, /<VaultGate/)
  assert.match(app, /<RebuildApp onLock={lockVault} />/)
  assert.doesNotMatch(app, /<AutoSyncRuntime/)
  assert.doesNotMatch(app, /<NotesWorkspace/)
  assert.match(app, /<AndroidBackRuntime />/)
})

test('v2 encrypted records use their own indexed additive store', () => {
  assert.match(database, /DATABASE_VERSION = 3/)
  assert.match(database, /V2_ENCRYPTED_RECORDS_STORE = 'encrypted_records_v2'/)
  assert.match(database, /keyPath: ['recordType', 'recordId']/)
  assert.match(database, /createIndex(V2_RECORD_TYPE_INDEX, 'recordType'/)
  assert.match(repository, /.index(V2_RECORD_TYPE_INDEX)/)
  assert.match(repository, /IDBKeyRange.only(recordType)/)
  assert.doesNotMatch(repository, /.getAll()[\s\S]*parseEncryptedRecordKey/)
})

test('v2 notes split list metadata from note body and persist both atomically', () => {
  assert.match(model, /NOTE_V2_META_TYPE = 'note\.v2\.meta'/)
  assert.match(model, /NOTE_V2_BODY_TYPE = 'note\.v2\.body'/)
  assert.match(service, /writeEncryptedV2Records\(\[/)
  assert.match(service, /recordType: NOTE_V2_META_TYPE/)
  assert.match(service, /recordType: NOTE_V2_BODY_TYPE/)
  assert.match(service, /format: 'plain-text-v1'/)
  assert.match(repository, /const transaction = database\.transaction\(V2_ENCRYPTED_RECORDS_STORE, 'readwrite'\)/)
  assert.match(repository, /encrypted\.forEach\(\(record\) => store\.put\(record\)\)/)
})

test('typing stays in editor state and local persistence happens on leave', () => {
  assert.match(rebuild, /text: event\.target\.value,[\s\S]*dirty: true/)
  assert.match(rebuild, /title: event\.target\.value,[\s\S]*dirty: true/)
  assert.match(rebuild, /async function leaveEditor\(\)/)
  assert.match(rebuild, /await saveRebuildNote\(editor\.meta, editor\.title, editor\.text\)/)
  assert.match(rebuild, /data-oanix-unsaved=\{editor\.dirty \? 'true' : 'false'\}/)
  assert.doesNotMatch(rebuild, /replaceNoteContent|parseEditorBlocks|innerHTML/)
})

test('slow operations expose delayed full-screen feedback instead of fake progress', () => {
  assert.match(rebuild, /useDelayedBusy\(saving\)/)
  assert.match(rebuild, /useDelayedBusy\(openingNote\)/)
  assert.match(rebuild, /className="rebuild-progress"/)
  assert.match(rebuild, /Cifrando y confirmando el guardado local/)
  assert.match(css, /\.rebuild-progress \{[\s\S]*position: fixed;[\s\S]*inset: 0;/)
  assert.match(css, /rebuildProgress/)
  assert.doesNotMatch(rebuild, /\d+%/)
})

test('folder identity and rebuild layout cover desktop mobile day and night', () => {
  assert.match(model, /V2_FOLDER_GRADIENTS/)
  assert.match(service, /gradientIndex: secureRandomIndex\(V2_FOLDER_GRADIENTS\.length\)/)
  assert.match(css, /\.rebuild-drawer__folder[\s\S]*background: var\(--folder-soft\)/)
  assert.match(css, /\.rebuild-notes::before[\s\S]*var\(--active-folder-cover/)
  assert.match(css, /data-oanix-theme-mode="light"/)
  assert.match(css, /@media \(max-width: 760px\)/)
  assert.match(css, /@media \(min-width: 900px\)/)
  assert.match(css, /env\(safe-area-inset-bottom\)/)
})
