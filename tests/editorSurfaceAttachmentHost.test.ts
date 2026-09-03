import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const host = readFileSync('src/features/editor/EditorSurface.tsx', 'utf8')
const registry = readFileSync('src/features/editor/editorSurfaceRegistry.ts', 'utf8')
const sheet = readFileSync('src/features/editor/implementations/OanixNotesSheetSurface.tsx', 'utf8')

test('editor host exposes attachment callbacks only for attachment-capable surfaces', () => {
  assert.match(host, /activeEditorSurface\.capabilities\.attachments/)
  assert.match(host, /await import\('\.\/editorAttachmentAdapter'\)/)
  assert.match(host, /loadEditorSurfaceAttachments\(noteId\)/)
  assert.match(host, /storeEditorSurfaceAttachment\(noteId, file\)/)
  assert.match(host, /loadEditorSurfaceAttachmentFile\(noteId, attachmentId\)/)
  assert.match(host, /removeEditorSurfaceAttachment\(noteId, attachmentId\)/)
  assert.match(host, /loadAttachments: undefined/)
  assert.match(host, /onRequestAttachmentStore: undefined/)
  assert.match(host, /loadAttachmentFile: undefined/)
  assert.match(host, /onRequestAttachmentRemove: undefined/)
})

test('approved OANIX Notes sheet activates attachments through the clean image layer boundary', () => {
  assert.match(registry, /id: 'oanix-notes-sheet-v1'/)
  assert.match(registry, /attachments: true/)
  assert.match(registry, /richBlocks: true/)
  assert.match(sheet, /decideOanixMixedDocumentLoad/)
  assert.match(sheet, /insertOanixImageBatch/)
  assert.match(sheet, /findOanixClipboardImage/)
  assert.match(sheet, /pendingMixedUpsertsRef/)
  assert.doesNotMatch(sheet, /insertOanixImageAtCursor/)
})

test('host and visual sheet do not import attachment storage repositories directly', () => {
  assert.doesNotMatch(host, /encryptedBlobRepository|encryptedRecordRepository|attachmentService|contentCrypto|vault/)
  assert.doesNotMatch(sheet, /encryptedBlobRepository|encryptedRecordRepository|attachmentService|contentCrypto|vault/)
})
