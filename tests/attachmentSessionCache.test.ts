import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  AttachmentSessionCache,
  cacheAttachmentFile,
  cacheAttachmentMetadata,
  getCachedAttachmentFile,
  getCachedAttachmentMetadata,
} from '../src/features/attachments/attachmentSessionCache.ts'
import { clearActiveVaultKey, setActiveVaultKey } from '../src/security/vault/vaultSession.ts'
import type { AttachmentMetadata } from '../src/features/attachments/attachmentTypes.ts'

function metadata(attachmentId: string, byteLength: number): AttachmentMetadata {
  return {
    attachmentId,
    name: `${attachmentId}.png`,
    mimeType: 'image/png',
    byteLength,
    createdAt: '2026-09-03T12:00:00.000Z',
  }
}

test('decrypted attachment cache is LRU-bounded instead of retaining every file', () => {
  const cache = new AttachmentSessionCache(6)
  const first = new File(['1234'], 'first.png', { type: 'image/png' })
  const second = new File(['5678'], 'second.png', { type: 'image/png' })

  cache.putFile('first', first)
  assert.equal(cache.getFile('first'), first)
  cache.putFile('second', second)

  assert.equal(cache.getFile('first'), null)
  assert.equal(cache.getFile('second'), second)
})

test('locking the vault clears decrypted files and attachment metadata from the session cache', () => {
  const file = new File(['image'], 'session.png', { type: 'image/png' })
  cacheAttachmentFile('session-image', file)
  cacheAttachmentMetadata('note-session', [metadata('session-image', file.size)])
  setActiveVaultKey({} as CryptoKey)

  assert.equal(getCachedAttachmentFile('session-image'), file)
  assert.equal(getCachedAttachmentMetadata('note-session')?.length, 1)

  clearActiveVaultKey()

  assert.equal(getCachedAttachmentFile('session-image'), null)
  assert.equal(getCachedAttachmentMetadata('note-session'), null)
})

test('image rendering stays demand-driven and does not decrypt every image on note open', () => {
  const source = readFileSync('src/features/editor/implementations/OanixMixedDocumentBody.tsx', 'utf8')
  assert.match(source, /new IntersectionObserver/)
  assert.match(source, /rootMargin: '320px 0px'/)
  assert.match(source, /if \(!requested \|\| !attachment \|\| attachment\.remote \|\| url\) return/)
  assert.match(source, /if \(!requested \|\| !attachment \|\| attachment\.remote \|\| url\) return[\s\S]*loadAttachmentFile\(attachment\.id\)/)
})
