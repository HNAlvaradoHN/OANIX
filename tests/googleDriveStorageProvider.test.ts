import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GOOGLE_DRIVE_APPDATA_SCOPE,
  GOOGLE_DRIVE_PROVIDER_ID,
  GoogleDriveStorageProvider,
} from '../src/features/largeObjects/googleDriveStorageProvider.ts'

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

function providerWithFetch(fetchImpl: typeof fetch) {
  return new GoogleDriveStorageProvider(async () => 'drive-access-token', fetchImpl)
}

test('Drive provider uses only appDataFolder and the narrow appdata scope contract', async () => {
  assert.equal(GOOGLE_DRIVE_APPDATA_SCOPE, 'https://www.googleapis.com/auth/drive.appdata')
  assert.equal(GOOGLE_DRIVE_PROVIDER_ID, 'google-drive-appdata-v1')

  let capturedUrl = ''
  let capturedInit: RequestInit | undefined
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input)
    capturedInit = init
    return new Response(null, {
      status: 200,
      headers: { Location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=session-1' },
    })
  }) as typeof fetch

  const provider = providerWithFetch(fetchImpl)
  const session = await provider.beginResumableUpload({
    objectId: 'random-object-123',
    expectedCiphertextBytes: 8 * 1024 * 1024 + 16,
  })

  assert.match(capturedUrl, /uploadType=resumable/)
  assert.equal(capturedInit?.method, 'POST')
  const headers = new Headers(capturedInit?.headers)
  assert.equal(headers.get('Authorization'), 'Bearer drive-access-token')
  assert.equal(headers.get('X-Upload-Content-Type'), 'application/octet-stream')
  const metadata = JSON.parse(String(capturedInit?.body)) as {
    name: string
    parents: string[]
    appProperties: Record<string, string>
  }
  assert.deepEqual(metadata.parents, ['appDataFolder'])
  assert.match(metadata.name, /^oanix-object-random-object-123\.bin$/)
  assert.equal(metadata.appProperties.oanixObjectId, 'random-object-123')
  assert.equal(session.providerId, GOOGLE_DRIVE_PROVIDER_ID)
  assert.equal(session.expectedCiphertextBytes, 8 * 1024 * 1024 + 16)
})

test('Drive status query trusts the server Range instead of assuming a full chunk arrived', async () => {
  const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(init?.method, 'PUT')
    assert.equal(new Headers(init?.headers).get('Content-Range'), 'bytes */2000000')
    return new Response(null, {
      status: 308,
      headers: { Range: 'bytes=0-799999' },
    })
  }) as typeof fetch
  const provider = providerWithFetch(fetchImpl)

  const status = await provider.inspectResumableUpload({
    providerId: GOOGLE_DRIVE_PROVIDER_ID,
    sessionRef: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=session-2',
    objectId: 'object-2',
    expectedCiphertextBytes: 2_000_000,
  })

  assert.deepEqual(status, { confirmedCiphertextBytes: 800_000, complete: false })
})

test('Drive upload sends the exact ciphertext range and accepts 308 partial confirmation', async () => {
  const sent = Uint8Array.from([11, 22, 33, 44])
  const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    assert.equal(init?.method, 'PUT')
    assert.equal(headers.get('Content-Range'), 'bytes 100-103/1000')
    const body = new Uint8Array(init?.body as ArrayBuffer)
    assert.deepEqual([...body], [...sent])
    return new Response(null, {
      status: 308,
      headers: { Range: 'bytes=0-102' },
    })
  }) as typeof fetch
  const provider = providerWithFetch(fetchImpl)

  const status = await provider.uploadCiphertextRange({
    session: {
      providerId: GOOGLE_DRIVE_PROVIDER_ID,
      sessionRef: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=session-3',
      objectId: 'object-3',
      expectedCiphertextBytes: 1000,
    },
    ciphertextOffset: 100,
    bytes: sent,
    totalCiphertextBytes: 1000,
  })

  assert.deepEqual(status, { confirmedCiphertextBytes: 103, complete: false })
})

test('Drive finalize refuses incomplete uploads and returns only an opaque remote id when complete', async () => {
  let call = 0
  const fetchImpl = (async () => {
    call += 1
    if (call === 1) {
      return new Response(null, { status: 308, headers: { Range: 'bytes=0-899' } })
    }
    return jsonResponse({ id: 'drive_file-ABC_123' }, { status: 200 })
  }) as typeof fetch
  const provider = providerWithFetch(fetchImpl)
  const session = {
    providerId: GOOGLE_DRIVE_PROVIDER_ID,
    sessionRef: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=session-4',
    objectId: 'object-4',
    expectedCiphertextBytes: 1000,
  }

  await assert.rejects(
    () => provider.finalizeResumableUpload(session),
    /todavía espera bytes cifrados \(900\/1000\)/,
  )

  const remote = await provider.finalizeResumableUpload(session)
  assert.deepEqual(remote, {
    providerId: GOOGLE_DRIVE_PROVIDER_ID,
    objectRef: 'drive_file-ABC_123',
    ciphertextByteLength: 1000,
  })
})

test('Drive partial download requests only the required byte range and validates its length', async () => {
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.match(String(input), /drive\/v3\/files\/drive_file-5\?alt=media$/)
    assert.equal(new Headers(init?.headers).get('Range'), 'bytes=200-203')
    return new Response(Uint8Array.from([1, 2, 3, 4]), { status: 206 })
  }) as typeof fetch
  const provider = providerWithFetch(fetchImpl)

  const bytes = await provider.downloadCiphertextRange({
    remoteObject: {
      providerId: GOOGLE_DRIVE_PROVIDER_ID,
      objectRef: 'drive_file-5',
      ciphertextByteLength: 1000,
    },
    ciphertextOffset: 200,
    ciphertextByteLength: 4,
  })
  assert.deepEqual([...bytes], [1, 2, 3, 4])
})

test('Drive delete is idempotent for already missing encrypted objects', async () => {
  let requested = ''
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requested = String(input)
    assert.equal(init?.method, 'DELETE')
    return new Response(null, { status: 404 })
  }) as typeof fetch
  const provider = providerWithFetch(fetchImpl)

  await provider.deleteRemoteObject({
    providerId: GOOGLE_DRIVE_PROVIDER_ID,
    objectRef: 'drive_file-6',
    ciphertextByteLength: 42,
  })
  assert.match(requested, /drive\/v3\/files\/drive_file-6$/)
})

test('Drive provider fails closed when a resumable session expires or belongs to another provider', async () => {
  const fetchImpl = (async () => new Response(null, { status: 404 })) as typeof fetch
  const provider = providerWithFetch(fetchImpl)

  await assert.rejects(
    () => provider.inspectResumableUpload({
      providerId: GOOGLE_DRIVE_PROVIDER_ID,
      sessionRef: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=expired',
      objectId: 'expired-object',
      expectedCiphertextBytes: 100,
    }),
    /sesión reanudable de Google Drive expiró/,
  )

  await assert.rejects(
    () => provider.inspectResumableUpload({
      providerId: 'some-other-provider',
      sessionRef: 'https://example.com/upload/session',
      objectId: 'foreign-object',
      expectedCiphertextBytes: 100,
    }),
    /pertenece a otro proveedor/,
  )
})

test('Drive resumable sessions are pinned to Google before OANIX can send a bearer token', async () => {
  let fetchCalls = 0
  const fetchImpl = (async () => {
    fetchCalls += 1
    return new Response(null, { status: 500 })
  }) as typeof fetch
  const provider = providerWithFetch(fetchImpl)

  await assert.rejects(
    () => provider.inspectResumableUpload({
      providerId: GOOGLE_DRIVE_PROVIDER_ID,
      sessionRef: 'https://evil.example/upload/drive/v3/files?upload_id=stolen-session',
      objectId: 'hostile-object',
      expectedCiphertextBytes: 100,
    }),
    /no pertenece al endpoint de Google Drive/,
  )
  assert.equal(fetchCalls, 0)
})
