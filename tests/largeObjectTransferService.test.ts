import assert from 'node:assert/strict'
import test from 'node:test'
import { MemoryLargeObjectTransferStateStore } from '../src/features/largeObjects/largeObjectUploadOrchestrator.ts'
import { transferLargeObject } from '../src/features/largeObjects/largeObjectTransferService.ts'
import type {
  LargeObjectDownloadRangeRequest,
  LargeObjectRemoteObject,
  LargeObjectUploadRangeRequest,
  LargeObjectUploadSession,
  LargeObjectUploadStatus,
  OanixStorageProvider,
} from '../src/features/largeObjects/largeObjectTransferContract.ts'

const CHUNK_BYTES = 1024 * 1024

async function key(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

class CapacityProvider implements OanixStorageProvider {
  readonly providerId = 'capacity-provider-v1'
  beginCalls = 0
  confirmed = 0
  availableBytes: number | null = null
  expected = 0

  async getStorageCapacity() {
    const limitBytes = this.availableBytes === null ? null : 10 * 1024 ** 3
    const usageBytes = limitBytes === null ? 0 : limitBytes - this.availableBytes
    return { providerId: this.providerId, usageBytes, limitBytes, availableBytes: this.availableBytes }
  }
  async beginResumableUpload(input: { objectId: string; expectedCiphertextBytes: number }): Promise<LargeObjectUploadSession> {
    this.beginCalls += 1
    this.expected = input.expectedCiphertextBytes
    return { providerId: this.providerId, sessionRef: 'memory://capacity', objectId: input.objectId, expectedCiphertextBytes: input.expectedCiphertextBytes }
  }
  async inspectResumableUpload(): Promise<LargeObjectUploadStatus> {
    return { confirmedCiphertextBytes: this.confirmed, complete: this.confirmed === this.expected && this.expected > 0 }
  }
  async uploadCiphertextRange(request: LargeObjectUploadRangeRequest): Promise<LargeObjectUploadStatus> {
    this.confirmed = request.ciphertextOffset + request.bytes.byteLength
    return { confirmedCiphertextBytes: this.confirmed, complete: this.confirmed === request.totalCiphertextBytes }
  }
  async finalizeResumableUpload(session: LargeObjectUploadSession): Promise<LargeObjectRemoteObject> {
    return { providerId: this.providerId, objectRef: 'remote-object', ciphertextByteLength: session.expectedCiphertextBytes }
  }
  async downloadCiphertextRange(_request: LargeObjectDownloadRangeRequest): Promise<Uint8Array> { return new Uint8Array() }
  async deleteRemoteObject(): Promise<void> {}
}

test('transfer service rejects insufficient capacity before creating a remote upload session', async () => {
  const provider = new CapacityProvider()
  provider.availableBytes = 512 * 1024
  const blob = new Blob([new Uint8Array(CHUNK_BYTES + 10)])
  const vaultKey = await key()

  await assert.rejects(
    () => transferLargeObject({
      blob,
      vaultKey,
      objectId: 'capacity-object-001',
      provider,
      stateStore: new MemoryLargeObjectTransferStateStore(),
      chunkBytes: CHUNK_BYTES,
    }),
    /no tiene espacio suficiente/u,
  )
  assert.equal(provider.beginCalls, 0)
})

test('transfer service allows providers with enough space and returns the capacity snapshot for future UI', async () => {
  const provider = new CapacityProvider()
  provider.availableBytes = 2 * 1024 ** 3
  const blob = new Blob([new Uint8Array(CHUNK_BYTES + 10)])
  const result = await transferLargeObject({
    blob,
    vaultKey: await key(),
    objectId: 'capacity-object-002',
    provider,
    stateStore: new MemoryLargeObjectTransferStateStore(),
    chunkBytes: CHUNK_BYTES,
  })

  assert.equal(provider.beginCalls, 1)
  assert.equal(result.capacityBeforeUpload?.availableBytes, 2 * 1024 ** 3)
  assert.ok(result.requiredCiphertextBytesBeforeUpload > blob.size)
})
