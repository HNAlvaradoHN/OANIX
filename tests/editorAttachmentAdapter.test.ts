import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { toEditorSurfaceAttachment } from '../src/features/editor/editorAttachmentAdapter.ts'

const adapterSource = readFileSync('src/features/editor/editorAttachmentAdapter.ts', 'utf8')
const contractSource = readFileSync('src/features/editor/editorSurfaceContract.ts', 'utf8')

test('editor attachment projection exposes only presentation-safe metadata', () => {
  const projected = toEditorSurfaceAttachment({
    attachmentId: 'attachment-1',
    name: 'foto.png',
    mimeType: 'image/png',
    byteLength: 2048,
    createdAt: '2026-09-03T04:00:00.000Z',
    storage: {
      mode: 'remote-large-v1',
      providerId: 'provider-private',
      objectId: 'object-private',
      objectRef: 'ref-private',
      ciphertextByteLength: 4096,
      chunkBytes: 1024,
      chunks: [{
        index: 0,
        plaintextOffset: 0,
        plaintextLength: 2048,
        ciphertextByteLength: 2080,
        iv: 'iv',
        sha256: 'sha',
      }],
    },
  })

  assert.deepEqual(projected, {
    id: 'attachment-1',
    name: 'foto.png',
    mimeType: 'image/png',
    byteLength: 2048,
    createdAt: '2026-09-03T04:00:00.000Z',
    remote: true,
  })
  assert.equal('storage' in projected, false)
  assert.equal('providerId' in projected, false)
  assert.equal('objectRef' in projected, false)
})

test('editor attachment adapter reuses OANIX attachment services instead of storage internals', () => {
  assert.match(adapterSource, /from '..\/attachments\/attachmentService'/)
  assert.doesNotMatch(adapterSource, /encryptedBlobRepository|encryptedRecordRepository|contentCrypto|vault/i)
  assert.doesNotMatch(adapterSource, /localStorage|sessionStorage|indexedDB|dataURL|base64/i)
})

test('editor surface contract keeps attachment bytes behind explicit callbacks', () => {
  assert.match(contractSource, /interface EditorSurfaceAttachment/)
  assert.match(contractSource, /loadAttachments\?: \(\) => Promise<EditorSurfaceAttachment\[\]>/)
  assert.match(contractSource, /onRequestAttachmentStore\?: \(file: File\) => Promise<EditorSurfaceAttachment>/)
  assert.match(contractSource, /loadAttachmentFile\?: \(attachmentId: string\) => Promise<File \| null>/)
  assert.match(contractSource, /onRequestAttachmentRemove\?: \(attachmentId: string\) => Promise<boolean>/)
  assert.doesNotMatch(contractSource, /providerId|objectRef|ciphertext|encryptedBlobRepository/)
})
