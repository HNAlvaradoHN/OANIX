import assert from 'node:assert/strict'
import test from 'node:test'
import { googleDriveBrowserFetch } from '../src/features/largeObjects/googleDriveAccessTokenLease.ts'

test('browser Drive wrapper removes Authorization only from resumable session PUTs', async () => {
  const originalFetch = globalThis.fetch
  const calls: Array<{ url: string; method: string; authorization: string | null }> = []

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: (init?.method ?? 'GET').toUpperCase(),
      authorization: new Headers(init?.headers).get('Authorization'),
    })
    return new Response(null, { status: 308 })
  }) as typeof fetch

  try {
    await googleDriveBrowserFetch(
      'https://www.googleapis.com/upload/drive/v3/files?upload_id=session-1',
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer temporary-token',
          'Content-Range': 'bytes 0-9/10',
        },
      },
    )

    await googleDriveBrowserFetch(
      'https://www.googleapis.com/drive/v3/about?fields=storageQuota',
      {
        method: 'GET',
        headers: { Authorization: 'Bearer temporary-token' },
      },
    )
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(calls.length, 2)
  assert.equal(calls[0]?.method, 'PUT')
  assert.equal(calls[0]?.authorization, null)
  assert.equal(calls[1]?.method, 'GET')
  assert.equal(calls[1]?.authorization, 'Bearer temporary-token')
})

test('browser Drive wrapper does not strip Authorization from unrelated PUT URLs', async () => {
  const originalFetch = globalThis.fetch
  let authorization: string | null = null

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    authorization = new Headers(init?.headers).get('Authorization')
    return new Response(null, { status: 200 })
  }) as typeof fetch

  try {
    await googleDriveBrowserFetch('https://www.googleapis.com/drive/v3/files/file-1', {
      method: 'PUT',
      headers: { Authorization: 'Bearer temporary-token' },
    })
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(authorization, 'Bearer temporary-token')
})
