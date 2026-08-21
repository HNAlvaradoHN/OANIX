import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const javaUrl = new URL('../android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixDriveAuthPlugin.java', import.meta.url)
const bridgeUrl = new URL('../src/features/largeObjects/googleDriveAndroidAuthorization.ts', import.meta.url)
const gradleUrl = new URL('../android/app/build.gradle', import.meta.url)
const mainActivityUrl = new URL('../android/app/src/main/java/io/github/hnalvaradohn/oanix/MainActivity.java', import.meta.url)

async function text(url: URL) {
  return await readFile(url, 'utf8')
}

test('Android Drive authorization uses Google AuthorizationClient with appData only', async () => {
  const java = await text(javaUrl)
  assert.match(java, /Identity\.getAuthorizationClient/u)
  assert.match(java, /AuthorizationRequest\.builder\(\)/u)
  assert.match(java, /https:\/\/www\.googleapis\.com\/auth\/drive\.appdata/u)
  assert.match(java, /setOptOutIncludingGrantedScopes\(true\)/u)
  assert.match(java, /AuthorizationRequest\.Prompt\.SELECT_ACCOUNT/u)
  assert.match(java, /getGrantedScopes\(\)/u)
})

test('Android Drive authorization returns only a short-lived access token to the in-memory lease', async () => {
  const java = await text(javaUrl)
  const bridge = await text(bridgeUrl)
  assert.match(java, /getAccessToken\(\)/u)
  assert.doesNotMatch(java, /SharedPreferences|provider_refresh_token|refreshToken|requestOfflineAccess/u)
  assert.match(bridge, /setGoogleDriveAccessTokenLease/u)
  assert.match(bridge, /clearGoogleDriveAccessTokenLease/u)
  assert.doesNotMatch(bridge, /localStorage|sessionStorage|indexedDB|oanix-vault/u)
})

test('Android registers the isolated Drive plugin and pins current Google auth dependency', async () => {
  const gradle = await text(gradleUrl)
  const activity = await text(mainActivityUrl)
  assert.match(gradle, /com\.google\.android\.gms:play-services-auth:21\.6\.0/u)
  assert.match(activity, /registerPlugin\(OanixDriveAuthPlugin\.class\)/u)
})

test('Drive authorization protects against concurrent consent flows and cancellation', async () => {
  const java = await text(javaUrl)
  assert.match(java, /authorizationActive/u)
  assert.match(java, /Ya hay una autorización de Google Drive en curso/u)
  assert.match(java, /cancelled/u)
  assert.match(java, /REQUEST_AUTHORIZE/u)
})
