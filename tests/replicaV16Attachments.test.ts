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

test('replica exposes image and file insertion only through the generic attachment callbacks', () => {
  assert.match(replica, /ReplicaV16Attachments/)
  assert.match(replica, /requestAttachmentInsert\('image'\)/)
  assert.match(replica, /requestAttachmentInsert\('file'\)/)
  assert.match(replica, /loadAttachments=\{loadAttachments\}/)
  assert.match(replica, /onRequestAttachmentStore=\{onRequestAttachmentStore\}/)
  assert.match(replica, /loadAttachmentFile=\{loadAttachmentFile\}/)
  assert.match(replica, /onRequestAttachmentRemove=\{onRequestAttachmentRemove\}/)
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

test('host memoizes attachment callbacks by note so typing does not reload metadata', () => {
  assert.match(host, /useMemo/)
  assert.match(host, /memoizedAttachmentCallbacks = useMemo/)
  assert.match(host, /\[props\.noteId\]/)
  assert.match(host, /\.\.\.memoizedAttachmentCallbacks/)
})
