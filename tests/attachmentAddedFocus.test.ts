import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/attachments/NoteAttachmentsRuntime.tsx', 'utf8')
const css = readFileSync('src/features/attachments/attachments.css', 'utf8')

test('el adjunto recién cifrado conserva su metadata para poder enfocarlo', () => {
  assert.match(runtime, /const storedItems: AttachmentMetadata\[\] = \[\]/)
  assert.match(runtime, /storedItems\.push\(await storeEncryptedAttachment/)
  assert.match(runtime, /setNewAttachmentIds\(new Set\(storedItems\.map\(\(item\) => item\.attachmentId\)\)\)/)
})

test('la nota desplaza la vista a la tarjeta nueva sin cambiar su persistencia', () => {
  assert.match(runtime, /data-oanix-new=\{isNew \? 'true' : 'false'\}/)
  assert.match(runtime, /querySelector<HTMLElement>\('\.note-attachment-card\[data-oanix-new="true"\]'/)
  assert.match(runtime, /scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\)/)
  assert.doesNotMatch(runtime, /writeEncryptedBlob|writeEncryptedRecord/)
})

test('la orientación visual es temporal y comunica hacia dónde quedó el archivo', () => {
  assert.match(runtime, /Archivo agregado ↓/)
  assert.match(runtime, /2400/)
  assert.match(runtime, /setNewAttachmentIds\(new Set\(\)\)/)
  assert.match(css, /note-attachment-card\[data-oanix-new='true'\]/)
  assert.match(css, /oanix-attachment-added/)
  assert.match(css, /prefers-reduced-motion: reduce/)
})
