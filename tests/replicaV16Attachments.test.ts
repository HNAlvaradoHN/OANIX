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

test('attachment flow anchors render inline and hidden metadata stays outside visual order', () => {
  assert.match(attachments, /createReplicaAttachmentFlowRef/)
  assert.match(attachments, /encodeReplicaAttachmentFlowRef/)
  assert.match(attachments, /decodeReplicaAttachmentFlowRef/)
  assert.match(attachments, /replicaFlowIndexToOrderIndex/)
  assert.match(attachments, /ReplicaV16AttachmentFlowContext\.Provider/)
  assert.match(richBlocks, /decodeReplicaAttachmentFlowRef/)
  assert.match(richBlocks, /ReplicaV16AttachmentBlock/)
  assert.match(richBlocks, /splitReplicaEditorBlocks\(blocks\)/)
  assert.match(richBlocks, /visibleBlocks\.map/)
  assert.match(richBlocks, /insertAttachment\('image', index\)/)
  assert.match(richBlocks, /insertAttachment\('file', index\)/)
})

test('existing attachments without anchors migrate by adding only lightweight flow references', () => {
  assert.match(attachments, /anchoredIds/)
  assert.match(attachments, /retiredIds/)
  assert.match(attachments, /if \(anchoredIds\.has\(item\.id\) \|\| retiredIds\.has\(item\.id\)\) continue/)
  assert.match(attachments, /blockSession\.insert\(encoded, rawIndex\)/)
  assert.match(attachments, /createReplicaAttachmentFlowRef\(item\.id, isImage\(item\) \? 'image' : 'file'\)/)
  assert.doesNotMatch(attachments, /blob:|data:image|readAsArrayBuffer|arrayBuffer\(\)/)
})

test('failed cleanup after image replacement retires the old asset instead of resurrecting it', () => {
  assert.match(attachments, /createReplicaAttachmentRetirement/)
  assert.match(attachments, /encodeReplicaAttachmentRetirement/)
  assert.match(attachments, /decodeReplicaAttachmentRetirement/)
  assert.match(attachments, /await blockSession\.upsert\(encodeReplicaAttachmentRetirement\(retirement\)\)/)
  assert.match(attachments, /setItems\(\(current\) => current\.map\(\(item\) => item\.id === oldItem\.id \? stored : item\)\)/)
  assert.doesNotMatch(attachments, /setItems\(\(current\) => \[\.\.\.current, stored\]\)\n\s*setError\('La imagen nueva se guardó y quedó referenciada/)
})

test('attachment insertion and file actions stay disabled during initial migration', () => {
  assert.match(attachments, /if \(disabled \|\| loading \|\| busy \|\| !enabled\) return/)
  assert.match(attachments, /if \(!insertRequest \|\| disabled \|\| loading \|\| !enabled\) return/)
  assert.match(attachments, /const contextBusy = loading \|\| busy/)
})

test('host memoizes attachment callbacks by note so typing does not reload metadata', () => {
  assert.match(host, /useMemo/)
  assert.match(host, /memoizedAttachmentCallbacks = useMemo/)
  assert.match(host, /\[props\.noteId\]/)
  assert.match(host, /\.\.\.memoizedAttachmentCallbacks/)
})
