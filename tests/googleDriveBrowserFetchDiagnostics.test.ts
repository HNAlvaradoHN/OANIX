import assert from 'node:assert/strict'
import test from 'node:test'
import { googleDriveBrowserFetch } from '../src/features/largeObjects/googleDriveAccessTokenLease.ts'

async function withFailingFetch(run: () => Promise<void>) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    throw new TypeError('Failed to fetch')
  }) as typeof fetch
  try {
    await run()
  } finally {
    globalThis.fetch = originalFetch
  }
}

test('Drive browser diagnostics identify resumable session creation failures', async () => {
  await withFailingFetch(async () => {
    await assert.rejects(
      () => googleDriveBrowserFetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',
        { method: 'POST' },
      ),
      /no pudo crear la sesión reanudable: Failed to fetch/,
    )
  })
})

test('Drive browser diagnostics identify encrypted chunk upload failures', async () => {
  await withFailingFetch(async () => {
    await assert.rejects(
      () => googleDriveBrowserFetch(
        'https://www.googleapis.com/upload/drive/v3/files?upload_id=session-1',
        {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer temporary-token',
            'Content-Range': 'bytes 0-8388623/134217984',
          },
          body: new ArrayBuffer(8),
        },
      ),
      /no pudo subir el fragmento cifrado: Failed to fetch/,
    )
  })
})

test('Drive browser diagnostics identify resumable status or finalize failures', async () => {
  await withFailingFetch(async () => {
    await assert.rejects(
      () => googleDriveBrowserFetch(
        'https://www.googleapis.com/upload/drive/v3/files?upload_id=session-2',
        {
          method: 'PUT',
          headers: { 'Content-Range': 'bytes */134217984' },
        },
      ),
      /no pudo consultar o finalizar la sesión reanudable: Failed to fetch/,
    )
  })
})
