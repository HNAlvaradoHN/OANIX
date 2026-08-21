import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MemoryLargeObjectTransferStateStore,
  uploadLargeObjectResumable,
} from '../src/features/largeObjects/largeObjectUploadOrchestrator.ts'
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
import {
  DEFAULT_LARGE_OBJECT_CHUNK_BYTES,
  type LargeObjectChunkManifest,
} from '../src/features/largeObjects/largeObjectProtocol.ts'

const MiB = 1024 * 1024
const FILE_BYTES = 128 * MiB

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  return new Uint8Array(Buffer.from(padded, 'base64'))
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

function chunkAdditionalData(objectId: string, manifest: LargeObjectChunkManifest): Uint8Array {
  return new TextEncoder().encode(JSON.stringify([
    'OANIX',
    'large-object',
    1,
    objectId,
    manifest.index,
    manifest.plaintextOffset,
    manifest.plaintextLength,
  ]))
}

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

test('controlled 128 MiB remote object verifies, decrypts chunk-by-chunk and deletes cleanly', async () => {
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

  for (const manifest of result.manifests) {
    const range = ranges[manifest.index]
    assert.ok(range)
    const ciphertext = await provider.downloadCiphertextRange({
      remoteObject: result.remoteObject,
      ciphertextOffset: range.ciphertextOffset,
      ciphertextByteLength: range.ciphertextByteLength,
    })

    const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', ciphertext))
    assert.equal(bytesToBase64Url(digest), manifest.sha256)

    const plaintextBuffer = await globalThis.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64UrlToBytes(manifest.iv),
        additionalData: chunkAdditionalData(objectId, manifest),
        tagLength: 128,
      },
      vaultKey,
      ciphertext,
    )
    const plaintext = new Uint8Array(plaintextBuffer)
    assert.equal(plaintext.byteLength, manifest.plaintextLength)
    assert.deepEqual(plaintext, sourceChunk.subarray(0, manifest.plaintextLength))
    plaintext.fill(0)
    ciphertext.fill(0)
  }

  await provider.deleteRemoteObject(result.remoteObject)
  assert.equal(provider.deleted, true)
  assert.equal(provider.confirmed, 0)
  assert.ok(provider.remote.every((byte) => byte === 0))
  assert.equal(await stateStore.load(objectId), null)
})
