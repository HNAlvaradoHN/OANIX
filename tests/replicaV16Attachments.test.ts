import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const host = readFileSync('src/features/editor/EditorSurface.tsx', 'utf8')
const replica = readFileSync(
  'src/features/editor/implementations/ReplicaV16SheetSurface.tsx',
  'utf8',
)
const attachments = readFileSync(
  'src/features/editor/implementations/ReplicaV16Attachments.tsx',
  'utf8',
)
const richBlocks = readFileSync(
  'src/features/editor/implementations/QwenRichBlocks.tsx',
  'utf8',
)

test('replica exposes image and file insertion only through the generic attachment callbacks', () => {
  assert.match(replica, /ReplicaV16Attachments/)
  assert.match(replica, /requestAttachmentInsert\('image'\)/)
  assert.match(replica, /requestAttachmentInsert\('file'\)/)
  assert.match(replica, /loadAttachments=\{loadAttachments\}/)
  assert.match(replica, /onRequestAttachmentStore=\{onRequestAttachmentStore\}/)
  assert.match(replica, /loadAttachmentFile=\{loadAttachmentFile\}/)
  assert.match(replica, /onRequestAttachmentRemove=\{onRequestAttachmentRemove\}/)
  assert.match(replica, /blockSession=\{blockSession\}/)
  assert.doesNotMatch(replica, /attachmentService|attachmentTypes|encryptedBlob|indexedDB|localStorage|sessionStorage/)
})

test('attachment presentation keeps binaries lazy and revokes temporary object URLs', () => {
  assert.match(attachments, /IntersectionObserver/)
  assert.match(attachments, /loadAttachmentFile\(item\.id\)/)
  assert.match(attachments, /URL\.createObjectURL\(file\)/)
  assert.match(attachments, /URL\.revokeObjectURL\(url\)/)
  assert.match(attachments, /type="file" accept="image\/\*"/)
  assert.match(attachments, /anchor\.download = item\.name/)
  assert.doesNotMatch(attachments, /readAsDataURL|data:image|base64|localStorage|sessionStorage|indexedDB/)
})

test('image menu stays on the discreet corner control rather than the image itself', () => {
  assert.match(attachments, /oanix-replica-asset__more/)
  assert.match(attachments, /aria-label=\{`Opciones de \$\{item\.name\}`\}/)
  assert.match(attachments, /Abrir/)
  assert.match(attachments, /Reemplazar/)
  assert.match(attachments, /Información/)
  assert.match(attachments, /Eliminar/)
  assert.doesNotMatch(attachments, /<img[^>]+onClick=/)
})

test('image presentation controls persist through the shared block session without touching binary storage', () => {
  assert.match(attachments, /decodeReplicaAttachmentPresentation/)
  assert.match(attachments, /encodeReplicaAttachmentPresentation/)
  assert.match(attachments, /blockSession\.upsert/)
  assert.match(attachments, /blockSession\.remove/)
  assert.match(attachments, /Desbloquear tamaño/)
  assert.match(attachments, /type="range"/)
  assert.match(attachments, /alignment/)
  assert.match(attachments, /Ocultar nombre/)
  assert.match(attachments, /Editar descripción/)
  assert.doesNotMatch(attachments, /storeEncryptedAttachment|loadEncryptedAttachmentFile|encrypted_records_v2/)
})

test('replica presentation records stay invisible to the normal rich block flow and survive content reorder', () => {
  assert.match(richBlocks, /REPLICA_ATTACHMENT_PRESENTATION_KIND/)
  assert.match(richBlocks, /visibleBlocks = blocks\.filter/)
  assert.match(richBlocks, /presentationBlocks = blocks\.filter/)
  assert.match(richBlocks, /const next = \[\.\.\.nextVisible, \.\.\.presentationBlocks\]/)
  assert.match(richBlocks, /visibleBlocks\.map/)
})

test('host memoizes attachment callbacks by note so typing does not reload metadata', () => {
  assert.match(host, /useMemo/)
  assert.match(host, /memoizedAttachmentCallbacks = useMemo/)
  assert.match(host, /\[props\.noteId\]/)
  assert.match(host, /\.\.\.memoizedAttachmentCallbacks/)
})
