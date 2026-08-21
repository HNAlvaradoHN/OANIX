import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  assertControlledGoogleDriveTransferSize,
  CONTROLLED_GOOGLE_DRIVE_MAX_BYTES,
  CONTROLLED_GOOGLE_DRIVE_MIN_BYTES,
  GOOGLE_DRIVE_PLAINTEXT_CHUNK_BYTES,
} from '../src/features/largeObjects/googleDriveControlledTransfer.ts'
import {
  DEFAULT_LARGE_OBJECT_CHUNK_BYTES,
  LARGE_OBJECT_AES_GCM_TAG_BYTES,
  LARGE_OBJECT_CHUNK_ALIGNMENT_BYTES,
} from '../src/features/largeObjects/largeObjectProtocol.ts'

const MiB = 1024 * 1024
const GiB = 1024 * MiB

test('controlled Google Drive entry is deliberately limited to 100 MiB–1 GiB', () => {
  assert.equal(CONTROLLED_GOOGLE_DRIVE_MIN_BYTES, 100 * MiB)
  assert.equal(CONTROLLED_GOOGLE_DRIVE_MAX_BYTES, 1 * GiB)

  assert.doesNotThrow(() => assertControlledGoogleDriveTransferSize(100 * MiB))
  assert.doesNotThrow(() => assertControlledGoogleDriveTransferSize(128 * MiB))
  assert.doesNotThrow(() => assertControlledGoogleDriveTransferSize(200 * MiB))
  assert.doesNotThrow(() => assertControlledGoogleDriveTransferSize(1 * GiB))

  assert.throws(() => assertControlledGoogleDriveTransferSize(99 * MiB), /100 MiB y 1 GiB/u)
  assert.throws(() => assertControlledGoogleDriveTransferSize(1 * GiB + 1), /100 MiB y 1 GiB/u)
  assert.throws(() => assertControlledGoogleDriveTransferSize(Number.NaN), /no es válido/u)
})

test('Drive crypto chunks produce 256 KiB-aligned ciphertext for every full chunk', () => {
  assert.equal(
    GOOGLE_DRIVE_PLAINTEXT_CHUNK_BYTES,
    DEFAULT_LARGE_OBJECT_CHUNK_BYTES - LARGE_OBJECT_AES_GCM_TAG_BYTES,
  )
  assert.equal(
    (GOOGLE_DRIVE_PLAINTEXT_CHUNK_BYTES + LARGE_OBJECT_AES_GCM_TAG_BYTES) %
      LARGE_OBJECT_CHUNK_ALIGNMENT_BYTES,
    0,
  )
  assert.equal(
    GOOGLE_DRIVE_PLAINTEXT_CHUNK_BYTES + LARGE_OBJECT_AES_GCM_TAG_BYTES,
    DEFAULT_LARGE_OBJECT_CHUNK_BYTES,
  )
})

test('controlled Google Drive upload and recovery reuse the provider without persisting credentials', async () => {
  const source = await readFile(
    new URL('../src/features/largeObjects/googleDriveControlledTransfer.ts', import.meta.url),
    'utf8',
  )

  assert.match(source, /hasUsableGoogleDriveAccessTokenLease/u)
  assert.match(source, /createGoogleDriveStorageProviderFromActiveLease/u)
  assert.match(source, /new PersistentLargeObjectTransferStateStore\(\)/u)
  assert.match(source, /chunkBytes: GOOGLE_DRIVE_PLAINTEXT_CHUNK_BYTES/u)
  assert.match(source, /return transferLargeObject\(/u)
  assert.match(source, /verifyLargeObjectRoundTrip/u)
  assert.match(source, /remoteObject: options\.transferResult\.remoteObject/u)
  assert.match(source, /manifests: options\.transferResult\.manifests/u)
  assert.doesNotMatch(source, /connectGoogleDriveAndInspect|authorizeGoogleDriveOnWeb|authorizeGoogleDriveOnAndroid/u)
  assert.doesNotMatch(source, /localStorage|sessionStorage|refreshToken|oanix-vault/u)
})

test('controlled UI verifies recovery only after the upload returns stored metadata', async () => {
  const source = await readFile(
    new URL('../src/features/account/GoogleDriveControlledTransferTest.tsx', import.meta.url),
    'utf8',
  )

  assert.match(source, /const result = await transferControlledGoogleDriveLargeObject/u)
  assert.match(source, /await verifyControlledGoogleDriveRoundTrip/u)
  assert.match(source, /transferResult: result/u)
  assert.match(source, /Recuperación verificada/u)
})
