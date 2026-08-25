import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const pickerUrl = new URL('../src/features/account/GoogleDriveControlledTransferPanel.tsx', import.meta.url)
const cardUrl = new URL('../src/features/account/GoogleDriveStorageCard.tsx', import.meta.url)

async function source(url: URL) {
  return await readFile(url, 'utf8')
}

test('controlled Drive field picker is visible only after Drive is connected', async () => {
  const card = await source(cardUrl)
  assert.match(card, /connected && \(/u)
  assert.match(card, /GoogleDriveControlledTransferPanel/u)
})

test('controlled picker reuses the active vault key and the 100 MiB–1 GiB transfer bridge', async () => {
  const picker = await source(pickerUrl)
  assert.match(picker, /requireActiveVaultKey\(\)/u)
  assert.match(picker, /transferControlledGoogleDriveLargeObject/u)
  assert.match(picker, /Probar archivo de 100 MiB–1 GiB/u)
  assert.doesNotMatch(picker, /localStorage|sessionStorage|refreshToken|accessToken/u)
})

test('controlled picker uses the original File directly instead of reading it completely into memory', async () => {
  const picker = await source(pickerUrl)
  assert.match(picker, /blob: file/u)
  assert.doesNotMatch(picker, /arrayBuffer\(|FileReader|readAsArrayBuffer/u)
})
