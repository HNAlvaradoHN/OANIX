import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const service = readFileSync('src/features/attachments/attachmentService.ts', 'utf8')
const mixedBody = readFileSync('src/features/editor/implementations/OanixMixedDocumentBody.tsx', 'utf8')

test('attachment metadata appends are serialized per note while blob stores may stay concurrent', () => {
  assert.match(service, /const attachmentIndexMutationTails = new Map<string, Promise<void>>\(\)/)
  assert.match(service, /async function serializeAttachmentIndexMutation<T>[\s\S]*previous\.catch\(\(\) => undefined\)\.then\(mutation\)/)
  assert.match(service, /async function appendAttachmentMetadata[\s\S]*serializeAttachmentIndexMutation\(noteId/)

  const localStore = service.slice(
    service.indexOf('export async function storeEncryptedAttachment'),
    service.indexOf('export async function storeRemoteLargeAttachment'),
  )
  const remoteStore = service.slice(
    service.indexOf('export async function storeRemoteLargeAttachment'),
    service.indexOf('export async function loadEncryptedAttachmentFile'),
  )

  assert.match(localStore, /await writeEncryptedBlob/)
  assert.match(localStore, /await appendAttachmentMetadata\(normalizedNoteId, metadata\)/)
  assert.doesNotMatch(localStore, /readAttachmentIndex\(normalizedNoteId\)[\s\S]*writeAttachmentIndex/)
  assert.match(remoteStore, /await appendAttachmentMetadata\(normalizedNoteId, metadata\)/)
})

test('an unavailable image block still exposes its menu so the user can remove it', () => {
  assert.match(mixedBody, /\{!disabled && <button[\s\S]*className="oanix-mixed-image__menu-button"/)
  assert.doesNotMatch(mixedBody, /\{url && !disabled && <button[\s\S]*className="oanix-mixed-image__menu-button"/)
  assert.match(mixedBody, /role="menuitem" className="is-danger"[\s\S]*removeImage\(\)/)
  assert.match(mixedBody, /role="menuitem" disabled=\{!url\}[\s\S]*Pantalla completa/)
})
