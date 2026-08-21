import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MemoryLargeObjectTransferStateStore,
  uploadLargeObjectResumable,
} from '../src/features/largeObjects/largeObjectUploadOrchestrator.ts'
import type {
  LargeObjectDownloadRangeRequest,
  LargeObjectRemoteObject,
  LargeObjectUploadRangeRequest,
  LargeObjectUploadSession,
  LargeObjectUploadStatus,
  OanixStorageProvider,
} from '../src/features/largeObjects/largeObjectTransferContract.ts'
import type { LargeObjectChunkManifest, LargeObjectChunkPlan } from '../src/features/largeObjects/largeObjectProtocol.ts'

const CHUNK_BYTES = 1024 * 1024

function ownedBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  const maxRandomValues = 65_536
  for (let offset = 0; offset < bytes.byteLength; offset += maxRandomValues) {
    crypto.getRandomValues(bytes.subarray(offset, Math.min(offset + maxRandomValues, bytes.byteLength)))
  }
  return bytes
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
}

function chunkAdditionalData(objectId: string, plan: LargeObjectChunkPlan): ArrayBuffer {
  const encoded = new TextEncoder().encode(JSON.stringify([
    'OANIX',
    'large-object',
    1,
    objectId,
    plan.index,
    plan.plaintextOffset,
    plan.plaintextLength,
  ]))
  return ownedBuffer(encoded)
}

class InterruptibleMemoryProvider implements OanixStorageProvider {
  readonly providerId = 'memory-provider-v1'
  readonly remote: Uint8Array
  confirmed = 0
  uploadCalls = 0
  interruptAfterPartial = true

  constructor(totalBytes: number) {
    this.remote = new Uint8Array(totalBytes)
  }

  async beginResumableUpload(input: { objectId: string; expectedCiphertextBytes: number }): Promise<LargeObjectUploadSession> {
    assert.equal(input.expectedCiphertextBytes, this.remote.byteLength)
    return {
      providerId: this.providerId,
      sessionRef: 'memory://session-1',
      objectId: input.objectId,
      expectedCiphertextBytes: input.expectedCiphertextBytes,
    }
  }

  async inspectResumableUpload(): Promise<LargeObjectUploadStatus> {
    return { confirmedCiphertextBytes: this.confirmed, complete: this.confirmed === this.remote.byteLength }
  }

  async uploadCiphertextRange(request: LargeObjectUploadRangeRequest): Promise<LargeObjectUploadStatus> {
    this.uploadCalls += 1
    if (this.interruptAfterPartial && this.uploadCalls === 2) {
      throw new Error('simulated network interruption')
    }

    let accepted = request.bytes.byteLength
    if (this.interruptAfterPartial && this.uploadCalls === 1) {
      accepted = Math.min(100_000, request.bytes.byteLength)
    }
    this.remote.set(request.bytes.subarray(0, accepted), request.ciphertextOffset)
    this.confirmed = request.ciphertextOffset + accepted
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
    return this.remote.slice(
      request.ciphertextOffset,
      request.ciphertextOffset + request.ciphertextByteLength,
    )
  }

  async deleteRemoteObject(): Promise<void> {}
}

async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function decryptRemote(
  remote: Uint8Array,
  manifests: LargeObjectChunkManifest[],
  key: CryptoKey,
  objectId: string,
): Promise<Uint8Array> {
  const parts: Uint8Array[] = []
  let ciphertextOffset = 0

  for (const manifest of manifests) {
    const ciphertext = remote.slice(ciphertextOffset, ciphertextOffset + manifest.ciphertextByteLength)
    ciphertextOffset += manifest.ciphertextByteLength
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ownedBuffer(decodeBase64Url(manifest.iv)),
        additionalData: chunkAdditionalData(objectId, manifest),
        tagLength: 128,
      },
      key,
      ownedBuffer(ciphertext),
    )
    parts.push(new Uint8Array(plaintext))
  }

  const total = parts.reduce((sum, part) => sum + part.byteLength, 0)
  const joined = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    joined.set(part, offset)
    offset += part.byteLength
  }
  return joined
}

test('orchestrator survives a mid-chunk interruption and resumes without re-encrypting confirmed bytes', async () => {
  const original = randomBytes(CHUNK_BYTES * 2 + 91_337)
  const blob = new Blob([ownedBuffer(original)])
  const key = await generateVaultKey()
  const objectId = 'orchestrator-object-001'
  const expectedCiphertextBytes = original.byteLength + 3 * 16
  const provider = new InterruptibleMemoryProvider(expectedCiphertextBytes)
  const stateStore = new MemoryLargeObjectTransferStateStore()

  await assert.rejects(
    () => uploadLargeObjectResumable({
      blob,
      vaultKey: key,
      objectId,
      provider,
      stateStore,
      chunkBytes: CHUNK_BYTES,
    }),
    /simulated network interruption/,
  )

  const interrupted = await stateStore.load(objectId)
  assert.ok(interrupted)
  assert.equal(interrupted.checkpoint.confirmedCiphertextBytes, 100_000)
  assert.equal(interrupted.checkpoint.activeChunk?.confirmedInsideChunk, 100_000)
  assert.ok(interrupted.retainedChunk)
  assert.equal(interrupted.manifests.length, 1)

  provider.interruptAfterPartial = false
  const result = await uploadLargeObjectResumable({
    blob,
    vaultKey: key,
    objectId,
    provider,
    stateStore,
    chunkBytes: CHUNK_BYTES,
  })

  assert.equal(result.manifests.length, 3)
  assert.deepEqual(result.manifests.map((manifest) => manifest.index), [0, 1, 2])
  assert.equal(await stateStore.load(objectId), null)
  assert.equal(provider.confirmed, expectedCiphertextBytes)

  const restored = await decryptRemote(provider.remote, result.manifests, key, objectId)
  assert.deepEqual(restored, original)
})

test('orchestrator fails closed when partial remote progress exists but the retained ciphertext is missing', async () => {
  const original = new Uint8Array(CHUNK_BYTES + 100)
  const blob = new Blob([ownedBuffer(original)])
  const key = await generateVaultKey()
  const objectId = 'orchestrator-object-002'
  const expectedCiphertextBytes = original.byteLength + 2 * 16
  const provider = new InterruptibleMemoryProvider(expectedCiphertextBytes)
  const stateStore = new MemoryLargeObjectTransferStateStore()

  await assert.rejects(
    () => uploadLargeObjectResumable({ blob, vaultKey: key, objectId, provider, stateStore, chunkBytes: CHUNK_BYTES }),
    /simulated network interruption/,
  )

  const snapshot = await stateStore.load(objectId)
  assert.ok(snapshot)
  await stateStore.save({ ...snapshot, retainedChunk: null })
  provider.interruptAfterPartial = false

  await assert.rejects(
    () => uploadLargeObjectResumable({ blob, vaultKey: key, objectId, provider, stateStore, chunkBytes: CHUNK_BYTES }),
    /Falta el fragmento temporal necesario/,
  )
})

test('progress never reports stored before the provider finalizes and all manifests exist', async () => {
  const original = new Uint8Array(CHUNK_BYTES + 1)
  const blob = new Blob([ownedBuffer(original)])
  const key = await generateVaultKey()
  const objectId = 'orchestrator-object-003'
  const provider = new InterruptibleMemoryProvider(original.byteLength + 2 * 16)
  provider.interruptAfterPartial = false
  const phases: string[] = []

  const result = await uploadLargeObjectResumable({
    blob,
    vaultKey: key,
    objectId,
    provider,
    stateStore: new MemoryLargeObjectTransferStateStore(),
    chunkBytes: CHUNK_BYTES,
    onProgress: (progress) => phases.push(progress.phase),
  })

  assert.equal(result.manifests.length, 2)
  assert.equal(phases.at(-2), 'verifying')
  assert.equal(phases.at(-1), 'stored')
})
