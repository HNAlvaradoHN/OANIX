import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  assertControlledGoogleDriveTransferSize,
  CONTROLLED_GOOGLE_DRIVE_MAX_BYTES,
  CONTROLLED_GOOGLE_DRIVE_MIN_BYTES,
} from '../src/features/largeObjects/googleDriveControlledTransfer.ts'

const MiB = 1024 * 1024

test('controlled Google Drive entry is deliberately limited to 100–200 MiB', () => {
  assert.equal(CONTROLLED_GOOGLE_DRIVE_MIN_BYTES, 100 * MiB)
  assert.equal(CONTROLLED_GOOGLE_DRIVE_MAX_BYTES, 200 * MiB)

  assert.doesNotThrow(() => assertControlledGoogleDriveTransferSize(100 * MiB))
  assert.doesNotThrow(() => assertControlledGoogleDriveTransferSize(128 * MiB))
  assert.doesNotThrow(() => assertControlledGoogleDriveTransferSize(200 * MiB))

  assert.throws(() => assertControlledGoogleDriveTransferSize(99 * MiB), /100 y 200 MiB/u)
  assert.throws(() => assertControlledGoogleDriveTransferSize(201 * MiB), /100 y 200 MiB/u)
  assert.throws(() => assertControlledGoogleDriveTransferSize(Number.NaN), /no es válido/u)
})

test('controlled Google Drive entry reuses the real provider, persistent encrypted state and transfer service', async () => {
  const source = await readFile(
    new URL('../src/features/largeObjects/googleDriveControlledTransfer.ts', import.meta.url),
    'utf8',
  )

  assert.match(source, /hasUsableGoogleDriveAccessTokenLease/u)
  assert.match(source, /createGoogleDriveStorageProviderFromActiveLease/u)
  assert.match(source, /new PersistentLargeObjectTransferStateStore\(\)/u)
  assert.match(source, /return transferLargeObject\(/u)
  assert.doesNotMatch(source, /connectGoogleDriveAndInspect|authorizeGoogleDriveOnWeb|authorizeGoogleDriveOnAndroid/u)
  assert.doesNotMatch(source, /localStorage|sessionStorage|refreshToken|oanix-vault/u)
})
