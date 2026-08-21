import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  clearGoogleDriveAccessTokenLease,
  hasUsableGoogleDriveAccessTokenLease,
  requireGoogleDriveAccessTokenLease,
  setGoogleDriveAccessTokenLease,
} from '../src/features/largeObjects/googleDriveAccessTokenLease.ts'

test('Drive access token lease stays usable only while safely away from expiry', async () => {
  clearGoogleDriveAccessTokenLease()
  const now = Date.now()
  setGoogleDriveAccessTokenLease('temporary-drive-token', now + 5 * 60_000)

  assert.equal(hasUsableGoogleDriveAccessTokenLease(now), true)
  assert.equal(hasUsableGoogleDriveAccessTokenLease(now + 4 * 60_000), false)
  assert.equal(await requireGoogleDriveAccessTokenLease(), 'temporary-drive-token')
  clearGoogleDriveAccessTokenLease()
  await assert.rejects(() => requireGoogleDriveAccessTokenLease(), /necesita autorización/u)
})

test('Drive token lease rejects already expired or malformed credentials', () => {
  clearGoogleDriveAccessTokenLease()
  assert.throws(
    () => setGoogleDriveAccessTokenLease('token with spaces', Date.now() + 120_000),
    /token de acceso no válido/u,
  )
  assert.throws(
    () => setGoogleDriveAccessTokenLease('valid-token', Date.now() - 1),
    /vigencia de acceso no válida/u,
  )
})

test('Drive token lease source never persists provider credentials in browser storage', async () => {
  const source = await readFile(
    new URL('../src/features/largeObjects/googleDriveAccessTokenLease.ts', import.meta.url),
    'utf8',
  )

  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|oanix-vault|saveLargeObjectTransferCache/u)
  assert.match(source, /let activeLease: GoogleDriveTokenLease \| null = null/u)
  assert.match(source, /clearGoogleDriveAccessTokenLease/u)
})
