import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const cardUrl = new URL('../src/features/account/GoogleDriveStorageCard.tsx', import.meta.url)
const panelUrl = new URL('../src/features/account/AccountPanel.tsx', import.meta.url)

async function source(url: URL) {
  return await readFile(url, 'utf8')
}

test('Drive storage card exposes only connection, quota refresh and disconnect actions', async () => {
  const text = await source(cardUrl)
  assert.match(text, /connectGoogleDriveAndInspect/u)
  assert.match(text, /inspectActiveGoogleDriveConnection/u)
  assert.match(text, /disconnectGoogleDriveSession/u)
  assert.doesNotMatch(text, /beginResumableUpload|uploadCiphertextRange|transferLargeObject|uploadLargeObjectResumable/u)
})

test('Drive card displays usage and available capacity without persisting credentials', async () => {
  const text = await source(cardUrl)
  assert.match(text, /usageBytes/u)
  assert.match(text, /availableBytes/u)
  assert.match(text, /role="progressbar"/u)
  assert.doesNotMatch(text, /localStorage|sessionStorage|indexedDB|provider_token|refreshToken/u)
})

test('Drive storage card is visible only in the normal workspace account panel', async () => {
  const text = await source(panelUrl)
  assert.match(text, /import \{ GoogleDriveStorageCard \}/u)
  assert.match(text, /context === 'workspace' && <GoogleDriveStorageCard \/>/u)
})
