import assert from 'node:assert/strict'
import test from 'node:test'

import {
  uploadLargeObjectResumable,
  type LargeObjectTransferSnapshot,
  type LargeObjectTransferStateStore,
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
import { DEFAULT_LARGE_OBJECT_CHUNK_BYTES } from '../src/features/largeObjects/largeObjectProtocol.ts'

const MiB = 1024 * 1024
const FILE_BYTES = 128 * MiB
const DROP_AT_BYTES = 72 * MiB + 65_536

function cloneSnapshot(snapshot: LargeObjectTransferSnapshot | null): LargeObjectTransferSnapshot | null {
  if (!snapshot) return null
  return {
    checkpoint: structuredClone(snapshot.checkpoint),
    retainedChunk: snapshot.retainedChunk
      ? { ...snapshot.retainedChunk, ciphertext: snapshot.retainedChunk.ciphertext.slice() }
      : null,
    manifests: snapshot.manifests.map((manifest) => ({ ...manifest })),
  }
}

class RestartDurableStateStore implements LargeObjectTransferStateStore {
  static persisted: LargeObjectTransferSnapshot | null = null

  async load(objectId: string): Promise<LargeObjectTransferSnapshot | null> {
    const persisted = RestartDurableStateStore.persisted
    if (!persisted || persisted.checkpoint.objectId !== objectId) return null
    return cloneSnapshot(persisted)
  }

  async save(snapshot: LargeObjectTransferSnapshot): Promise<void> {
    RestartDurableStateStore.persisted = cloneSnapshot(snapshot)
  }

  async clear(objectId: string): Promise<void> {
    if (RestartDurableStateStore.persisted?.checkpoint.objectId === objectId) {
      RestartDurableStateStore.persisted = null
    }
  }
}

class RestartAwareProvider implements OanixStorageProvider {
  readonly providerId = 'restart-memory-provider-v1'
  readonly remote: Uint8Array
  confirmed = 0
  dropEnabled = true

  constructor(totalBytes: number) {
    this.remote = new Uint8Array(totalBytes)
  }

  async beginResumableUpload(input: { objectId: string; expectedCiphertextBytes: number }): Promise<LargeObjectUploadSession> {
    assert.equal(input.expectedCiphertextBytes, this.remote.byteLength)
    return {
      providerId: this.providerId,
      sessionRef: 'memory://restart-128mib',
      objectId: input.objectId,
      expectedCiphertextBytes: input.expectedCiphertextBytes,
    }
  }

  async inspectResumableUpload(): Promise<LargeObjectUploadStatus> {
    return { confirmedCiphertextBytes: this.confirmed, complete: this.confirmed === this.remote.byteLength }
  }

  async uploadCiphertextRange(request: LargeObjectUploadRangeRequest): Promise<LargeObjectUploadStatus> {
    if (this.dropEnabled && request.ciphertextOffset < DROP_AT_BYTES) {
      const accepted = Math.min(request.bytes.byteLength, DROP_AT_BYTES - request.ciphertextOffset)
      if (accepted > 0) {
        this.remote.set(request.bytes.subarray(0, accepted), request.ciphertextOffset)
        this.confirmed = request.ciphertextOffset + accepted
      }
      if (this.confirmed >= DROP_AT_BYTES) {
        throw new Error('simulated app termination during 128 MiB upload')
      }
      return { confirmedCiphertextBytes: this.confirmed, complete: false }
    }

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
    return this.remote.slice(request.ciphertextOffset, request.ciphertextOffset + request.ciphertextByteLength)
  }

  async deleteRemoteObject(): Promise<void> {}
}

async function createVaultKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

test('128 MiB transfer survives a simulated app restart and resumes from remote-confirmed progress', async () => {
  RestartDurableStateStore.persisted = null
  const sourceChunk = new Uint8Array(DEFAULT_LARGE_OBJECT_CHUNK_BYTES)
  for (let index = 0; index < sourceChunk.length; index += 1) sourceChunk[index] = (index * 17) % 251
  const blob = new Blob(new Array(FILE_BYTES / sourceChunk.byteLength).fill(sourceChunk))
  const ranges = planLargeObjectCiphertextRanges(blob.size)
  const totalCiphertextBytes = totalCiphertextBytesForRanges(ranges)
  const provider = new RestartAwareProvider(totalCiphertextBytes)
  const vaultKey = await createVaultKey()
  const objectId = 'controlled-128mib-restart-001'

  const firstProcessStore = new RestartDurableStateStore()
  await assert.rejects(
    () => uploadLargeObjectResumable({ blob, vaultKey, objectId, provider, stateStore: firstProcessStore }),
    /simulated app termination/,
  )

  const persistedAfterDrop = RestartDurableStateStore.persisted
  assert.ok(persistedAfterDrop)
  assert.ok(persistedAfterDrop.checkpoint.confirmedCiphertextBytes > 0)
  assert.ok(provider.confirmed > persistedAfterDrop.checkpoint.confirmedCiphertextBytes)
  assert.ok(persistedAfterDrop.retainedChunk)
  assert.ok(persistedAfterDrop.checkpoint.activeChunk)
  const remoteBeforeRestart = provider.confirmed

  provider.dropEnabled = false
  const secondProcessStore = new RestartDurableStateStore()
  const result = await uploadLargeObjectResumable({
    blob,
    vaultKey,
    objectId,
    provider,
    stateStore: secondProcessStore,
  })

  assert.equal(remoteBeforeRestart, DROP_AT_BYTES)
  assert.equal(provider.confirmed, totalCiphertextBytes)
  assert.equal(result.manifests.length, 16)
  assert.equal(RestartDurableStateStore.persisted, null)
})
