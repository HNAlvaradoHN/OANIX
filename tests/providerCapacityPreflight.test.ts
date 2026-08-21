import assert from 'node:assert/strict'
import test from 'node:test'
import { GoogleDriveStorageProvider } from '../src/features/largeObjects/googleDriveStorageProvider.ts'
import {
  ensureProviderCapacityForBytes,
  type OanixStorageProvider,
} from '../src/features/largeObjects/largeObjectTransferContract.ts'

function minimalProvider(): OanixStorageProvider {
  return {
    providerId: 'local-no-quota-v1',
    async beginResumableUpload() { throw new Error('not used') },
    async inspectResumableUpload() { throw new Error('not used') },
    async uploadCiphertextRange() { throw new Error('not used') },
    async finalizeResumableUpload() { throw new Error('not used') },
    async downloadCiphertextRange() { throw new Error('not used') },
    async deleteRemoteObject() {},
  }
}

test('providers without a quota API remain valid alternatives', async () => {
  const provider = minimalProvider()
  assert.equal(await ensureProviderCapacityForBytes(provider, 5 * 1024 ** 3), null)
})

test('Google Drive reads total account quota through about.get using the existing bearer token', async () => {
  let requestedUrl = ''
  let requestedAuthorization = ''
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = String(input)
    requestedAuthorization = new Headers(init?.headers).get('Authorization') ?? ''
    return new Response(JSON.stringify({
      storageQuota: {
        limit: String(100 * 1024 ** 3),
        usage: String(37 * 1024 ** 3),
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  const provider = new GoogleDriveStorageProvider(async () => 'drive-token', fetchImpl)
  const capacity = await provider.getStorageCapacity()

  assert.match(requestedUrl, /drive\/v3\/about\?fields=storageQuota\(limit,usage\)$/u)
  assert.equal(requestedAuthorization, 'Bearer drive-token')
  assert.equal(capacity.limitBytes, 100 * 1024 ** 3)
  assert.equal(capacity.usageBytes, 37 * 1024 ** 3)
  assert.equal(capacity.availableBytes, 63 * 1024 ** 3)
})

test('preflight rejects a large file before upload when the selected provider lacks space', async () => {
  const provider: OanixStorageProvider = {
    ...minimalProvider(),
    providerId: 'quota-provider-v1',
    async getStorageCapacity() {
      return {
        providerId: 'quota-provider-v1',
        usageBytes: 98 * 1024 ** 3,
        limitBytes: 100 * 1024 ** 3,
        availableBytes: 2 * 1024 ** 3,
      }
    },
  }

  await assert.rejects(
    () => ensureProviderCapacityForBytes(provider, 5 * 1024 ** 3),
    /no tiene espacio suficiente/u,
  )
})

test('Google Drive accounts without a reported limit stay usable instead of inventing a quota', async () => {
  const fetchImpl = (async () => new Response(JSON.stringify({
    storageQuota: { usage: '123456789' },
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch
  const provider = new GoogleDriveStorageProvider(async () => 'drive-token', fetchImpl)

  const capacity = await provider.getStorageCapacity()
  assert.equal(capacity.usageBytes, 123456789)
  assert.equal(capacity.limitBytes, null)
  assert.equal(capacity.availableBytes, null)
  assert.doesNotReject(() => ensureProviderCapacityForBytes(provider, 5 * 1024 ** 3))
})

test('capacity validation rejects inconsistent provider reports', async () => {
  const provider: OanixStorageProvider = {
    ...minimalProvider(),
    providerId: 'broken-quota-v1',
    async getStorageCapacity() {
      return {
        providerId: 'broken-quota-v1',
        usageBytes: 10,
        limitBytes: 100,
        availableBytes: 95,
      }
    },
  }

  await assert.rejects(
    () => ensureProviderCapacityForBytes(provider, 1),
    /capacidad disponible inconsistente/u,
  )
})
