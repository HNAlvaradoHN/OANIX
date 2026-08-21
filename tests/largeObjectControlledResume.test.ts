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
  type LargeObjectTransferProgress,
} from '../src/features/largeObjects/largeObjectProtocol.ts'

const MiB = 1024 * 1024
const CONTROLLED_FILE_BYTES = 128 * MiB
const INTERRUPT_AFTER_BYTES = 64 * MiB + 131_072

class ControlledInterruptProvider implements OanixStorageProvider {
  readonly providerId = 'controlled-memory-provider-v1'
  readonly remote: Uint8Array
  confirmed = 0
  shouldInterrupt = true
  interruptionObserved = false

  constructor(totalBytes: number) {
    this.remote = new Uint8Array(totalBytes)
  }

  async beginResumableUpload(input: { objectId: string; expectedCiphertextBytes: number }): Promise<LargeObjectUploadSession> {
    assert.equal(input.expectedCiphertextBytes, this.remote.byteLength)
    return {
      providerId: this.providerId,
      sessionRef: 'memory://controlled-128mib-resume',
      objectId: input.objectId,
      expectedCiphertextBytes: input.expectedCiphertextBytes,
    }
  }

  async inspectResumableUpload(): Promise<LargeObjectUploadStatus> {
    return { confirmedCiphertextBytes: this.confirmed, complete: this.confirmed === this.remote.byteLength }
  }

  async uploadCiphertextRange(request: LargeObjectUploadRangeRequest): Promise<LargeObjectUploadStatus> {
    if (this.shouldInterrupt && !this.interruptionObserved && request.ciphertextOffset < INTERRUPT_AFTER_BYTES) {
      const accepted = Math.min(request.bytes.byteLength, INTERRUPT_AFTER_BYTES - request.ciphertextOffset)
      if (accepted > 0) {
        this.remote.set(request.bytes.subarray(0, accepted), request.ciphertextOffset)
        this.confirmed = request.ciphertextOffset + accepted
      }
      if (this.confirmed >= INTERRUPT_AFTER_BYTES) {
        this.interruptionObserved = true
        throw new Error('controlled 128 MiB network interruption')
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

test('controlled 128 MiB upload resumes after a mid-chunk interruption without restarting from zero', async () => {
  const sourceChunk = new Uint8Array(DEFAULT_LARGE_OBJECT_CHUNK_BYTES)
  for (let index = 0; index < sourceChunk.length; index += 1) sourceChunk[index] = index % 251
  const blob = new Blob(new Array(CONTROLLED_FILE_BYTES / sourceChunk.byteLength).fill(sourceChunk))
  const ranges = planLargeObjectCiphertextRanges(blob.size)
  const expectedCiphertextBytes = totalCiphertextBytesForRanges(ranges)
  const provider = new ControlledInterruptProvider(expectedCiphertextBytes)
  const stateStore = new MemoryLargeObjectTransferStateStore()
  const vaultKey = await createVaultKey()
  const objectId = 'controlled-128mib-resume-001'

  await assert.rejects(
    () => uploadLargeObjectResumable({ blob, vaultKey, objectId, provider, stateStore }),
    /controlled 128 MiB network interruption/,
  )

  const interrupted = await stateStore.load(objectId)
  assert.ok(interrupted)
  const locallyCheckpointedBeforeDrop = interrupted.checkpoint.confirmedCiphertextBytes
  assert.equal(provider.confirmed, INTERRUPT_AFTER_BYTES)
  assert.ok(locallyCheckpointedBeforeDrop > 0)
  assert.ok(provider.confirmed > locallyCheckpointedBeforeDrop)
  assert.equal(locallyCheckpointedBeforeDrop, ranges[8].ciphertextOffset)
  assert.ok(interrupted.checkpoint.activeChunk)
  assert.ok(interrupted.retainedChunk)
  assert.equal(interrupted.checkpoint.activeChunk.index, 8)

  provider.shouldInterrupt = false
  const remoteConfirmedBeforeResume = provider.confirmed
  const resumedProgress: LargeObjectTransferProgress[] = []
  const result = await uploadLargeObjectResumable({
    blob,
    vaultKey,
    objectId,
    provider,
    stateStore,
    onProgress: (progress) => resumedProgress.push(progress),
  })

  assert.equal(remoteConfirmedBeforeResume, INTERRUPT_AFTER_BYTES)
  assert.equal(provider.confirmed, expectedCiphertextBytes)
  assert.equal(result.manifests.length, 16)
  assert.equal(await stateStore.load(objectId), null)
  assert.equal(resumedProgress[0]?.phase, 'preparing')
  assert.ok(resumedProgress.some((progress) => progress.phase === 'uploading' && progress.processedBytes > 0))
  assert.equal(resumedProgress.at(-2)?.phase, 'verifying')
  assert.equal(resumedProgress.at(-1)?.phase, 'stored')
})
