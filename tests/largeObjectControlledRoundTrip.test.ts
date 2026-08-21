import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MemoryLargeObjectTransferStateStore,
  uploadLargeObjectResumable,
} from '../src/features/largeObjects/largeObjectUploadOrchestrator.ts'
import { verifyLargeObjectRoundTrip } from '../src/features/largeObjects/largeObjectRoundTripVerifier.ts'
import {
  planLargeObjectCiphertextRanges,
  totalCiphertextBytesForRanges,
  type LargeObjectDownloadRangeRequest,
  type LargeObjectRemoteObject,
  type LargeObjectUploadRangeRequest,
  type LargeObjectUploadSession,
  type LargeObjectUploadStatus,
  type OanixStorageProvider,
} from '../src/features/largeObjects/largeObjectTransferContract.ts'
import { DEFAULT_LARGE_OBJECT_CHUNK_BYTES } from '../src/features/largeObjects/largeObjectProtocol.ts'

const MiB = 1024 * 1024
const FILE_BYTES = 128 * MiB

class VerifiableMemoryProvider implements OanixStorageProvider {
  readonly providerId = 'verifiable-memory-provider-v1'
  readonly remote: Uint8Array
  confirmed = 0
  deleted = false

  constructor(totalBytes: number) {
    this.remote = new Uint8Array(totalBytes)
  }

  async beginResumableUpload(input: { objectId: string; expectedCiphertextBytes: number }): Promise<LargeObjectUploadSession> {
    assert.equal(input.expectedCiphertextBytes, this.remote.byteLength)
    return {
      providerId: this.providerId,
      sessionRef: 'memory://controlled-roundtrip-128mib',
      objectId: input.objectId,
      expectedCiphertextBytes: input.expectedCiphertextBytes,
    }
  }

  async inspectResumableUpload(): Promise<LargeObjectUploadStatus> {
    return { confirmedCiphertextBytes: this.confirmed, complete: this.confirmed === this.remote.byteLength }
  }

  async uploadCiphertextRange(request: LargeObjectUploadRangeRequest): Promise<LargeObjectUploadStatus> {
    this.remote.set(request.bytes, request.ciphertextOffset)
    this.confirmed = request.ciphertextOffset + request.bytes.byteLength
    return { confirmedCiphertextBytes: this.confirmed, complete: this.confirmed === this.remote.byteLength }
  }

  async finalizeResumableUpload(session: LargeObjectUploadSession): Promise<LargeObjectRemoteObject> {
    assert.equal(this.confirmed, this.remote.byteLength)
    return {
      providerId: this.providerId,
      objectRef: `${session.objectId}-remote`,
      ciphertextByteLength: this.remote.byteLength,
    }
  }

  async downloadCiphertextRange(request: LargeObjectDownloadRangeRequest): Promise<Uint8Array> {
    assert.equal(request.remoteObject.providerId, this.providerId)
    return this.remote.slice(request.ciphertextOffset, request.ciphertextOffset + request.ciphertextByteLength)
  }

  async deleteRemoteObject(remoteObject: LargeObjectRemoteObject): Promise<void> {
    assert.equal(remoteObject.providerId, this.providerId)
    this.remote.fill(0)
    this.confirmed = 0
    this.deleted = true
  }
}

async function createVaultKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

test('controlled 128 MiB remote object verifies and decrypts chunk-by-chunk using the production verifier', async () => {
  const sourceChunk = new Uint8Array(DEFAULT_LARGE_OBJECT_CHUNK_BYTES)
  for (let index = 0; index < sourceChunk.length; index += 1) sourceChunk[index] = (index * 29 + 7) % 251
  const blob = new Blob(new Array(FILE_BYTES / sourceChunk.byteLength).fill(sourceChunk))
  const ranges = planLargeObjectCiphertextRanges(blob.size)
  const expectedCiphertextBytes = totalCiphertextBytesForRanges(ranges)
  const provider = new VerifiableMemoryProvider(expectedCiphertextBytes)
  const stateStore = new MemoryLargeObjectTransferStateStore()
  const vaultKey = await createVaultKey()
  const objectId = 'controlled-128mib-roundtrip-001'

  const result = await uploadLargeObjectResumable({
    blob,
    vaultKey,
    objectId,
    provider,
    stateStore,
  })

  assert.equal(result.manifests.length, 16)
  assert.equal(result.remoteObject.ciphertextByteLength, expectedCiphertextBytes)

  const progress: number[] = []
  const verified = await verifyLargeObjectRoundTrip({
    blob,
    vaultKey,
    objectId,
    provider,
    remoteObject: result.remoteObject,
    manifests: result.manifests,
    onProgress: (verifiedBytes) => progress.push(verifiedBytes),
  })

  assert.equal(verified.chunkCount, 16)
  assert.equal(verified.verifiedPlaintextBytes, FILE_BYTES)
  assert.equal(verified.verifiedCiphertextBytes, expectedCiphertextBytes)
  assert.equal(progress[0], 0)
  assert.equal(progress.at(-1), FILE_BYTES)
  assert.equal(await stateStore.load(objectId), null)

  await provider.deleteRemoteObject(result.remoteObject)
  assert.equal(provider.deleted, true)
  assert.equal(provider.confirmed, 0)
  assert.ok(provider.remote.every((byte) => byte === 0))
})

test('round-trip verifier rejects remote ciphertext changed after upload', async () => {
  const blob = new Blob([new Uint8Array(MiB).fill(0x3c)])
  const ranges = planLargeObjectCiphertextRanges(blob.size, MiB)
  const provider = new VerifiableMemoryProvider(totalCiphertextBytesForRanges(ranges))
  const vaultKey = await createVaultKey()
  const objectId = 'controlled-roundtrip-tamper-001'
  const result = await uploadLargeObjectResumable({
    blob,
    vaultKey,
    objectId,
    provider,
    stateStore: new MemoryLargeObjectTransferStateStore(),
    chunkBytes: MiB,
  })

  provider.remote[0] ^= 0xff

  await assert.rejects(
    verifyLargeObjectRoundTrip({
      blob,
      vaultKey,
      objectId,
      provider,
      remoteObject: result.remoteObject,
      manifests: result.manifests,
    }),
    /integridad SHA-256/u,
  )
})
