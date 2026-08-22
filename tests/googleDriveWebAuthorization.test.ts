import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sourceUrl = new URL('../src/features/largeObjects/googleDriveWebAuthorization.ts', import.meta.url)

async function source() {
  return await readFile(sourceUrl, 'utf8')
}

test('web Drive authorization is optional and separated from Android native authorization', async () => {
  const text = await source()
  assert.match(text, /VITE_GOOGLE_DRIVE_WEB_CLIENT_ID/u)
  assert.match(text, /isAndroidNativeAccountAuth/u)
  assert.match(text, /Android usa una autorización nativa separada/u)
  assert.match(text, /https:\/\/accounts\.google\.com\/gsi\/client/u)
})

test('web Drive authorization requests only appData scope and verifies the granted scope', async () => {
  const text = await source()
  assert.match(text, /scope: GOOGLE_DRIVE_APPDATA_SCOPE/u)
  assert.match(text, /include_granted_scopes: false/u)
  assert.match(text, /scopeWasGranted\(response\.scope\)/u)
  assert.match(text, /requestGoogleDriveAccessToken\('select_account'\)/u)
})

test('web Drive can renew an already granted short-lived lease without selecting the account again', async () => {
  const text = await source()
  assert.match(text, /refreshGoogleDriveOnWebSilently/u)
  assert.match(text, /requestGoogleDriveAccessToken\(''\)/u)
})

test('web Drive access token is handed only to the in-memory lease', async () => {
  const text = await source()
  assert.match(text, /setGoogleDriveAccessTokenLease\(token,/u)
  assert.match(text, /clearGoogleDriveAccessTokenLease/u)
  assert.doesNotMatch(text, /localStorage|sessionStorage|indexedDB|oanix-vault|provider_token|provider_refresh_token/u)
})
