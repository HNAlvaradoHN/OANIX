import assert from 'node:assert/strict'
import test from 'node:test'

import {
  clearGoogleDriveAccessTokenLease,
  createGoogleDriveStorageProviderFromActiveLease,
  setGoogleDriveAccessTokenLease,
} from '../src/features/largeObjects/googleDriveAccessTokenLease.ts'

test('Drive provider calls browser fetch with the global receiver', async () => {
  const originalFetch = globalThis.fetch

  try {
    globalThis.fetch = function (this: unknown) {
      assert.equal(this, globalThis)
      return Promise.resolve(new Response(JSON.stringify({
        storageQuota: {
          limit: '1000',
          usage: '250',
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    } as typeof fetch

    setGoogleDriveAccessTokenLease('temporary-test-token', Date.now() + 5 * 60_000)
    const provider = createGoogleDriveStorageProviderFromActiveLease()
    const capacity = await provider.getStorageCapacity()

    assert.equal(capacity.usageBytes, 250)
    assert.equal(capacity.limitBytes, 1000)
    assert.equal(capacity.availableBytes, 750)
  } finally {
    clearGoogleDriveAccessTokenLease()
    globalThis.fetch = originalFetch
  }
})
