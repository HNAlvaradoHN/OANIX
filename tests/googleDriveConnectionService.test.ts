import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const serviceUrl = new URL('../src/features/largeObjects/googleDriveConnectionService.ts', import.meta.url)

async function source() {
  return await readFile(serviceUrl, 'utf8')
}

test('Drive connection service keeps Android and web authorization behind one internal entrypoint', async () => {
  const text = await source()
  assert.match(text, /authorizeGoogleDriveOnAndroid/u)
  assert.match(text, /authorizeGoogleDriveOnWeb/u)
  assert.match(text, /getGoogleDriveConnectionAvailability/u)
  assert.match(text, /connectGoogleDriveAndInspect/u)
})

test('Drive connection handshake validates quota before any upload API is exposed', async () => {
  const text = await source()
  assert.match(text, /getStorageCapacity\(\)/u)
  assert.doesNotMatch(text, /beginResumableUpload|uploadCiphertextRange|transferLargeObject|uploadLargeObjectResumable/u)
})

test('failed Drive handshakes fail closed by clearing the in-memory credential', async () => {
  const text = await source()
  assert.match(text, /catch \(error\) \{\s*clearGoogleDriveAccessTokenLease\(\)/u)
  assert.match(text, /throw error/u)
})

test('disconnect means clearing only the OANIX session and does not silently revoke Google grants', async () => {
  const text = await source()
  assert.match(text, /disconnectGoogleDriveSession/u)
  assert.match(text, /clearGoogleDriveAccessTokenLease\(\)/u)
  assert.doesNotMatch(text, /revoke|disableAutoSelect|refreshToken|provider_token/u)
})
