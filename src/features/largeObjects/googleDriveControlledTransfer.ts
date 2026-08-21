import { createGoogleDriveStorageProviderFromActiveLease, hasUsableGoogleDriveAccessTokenLease } from './googleDriveAccessTokenLease.ts'
import {
  DEFAULT_LARGE_OBJECT_CHUNK_BYTES,
  LARGE_OBJECT_AES_GCM_TAG_BYTES,
  LARGE_OBJECT_CHUNK_ALIGNMENT_BYTES,
} from './largeObjectProtocol.ts'
import { verifyLargeObjectRoundTrip, type VerifyLargeObjectRoundTripResult } from './largeObjectRoundTripVerifier.ts'
import { PersistentLargeObjectTransferStateStore } from './persistentLargeObjectTransferStateStore.ts'
import {
  transferLargeObject,
  type TransferLargeObjectResult,
} from './largeObjectTransferService.ts'

const MiB = 1024 * 1024

export const CONTROLLED_GOOGLE_DRIVE_MIN_BYTES = 100 * MiB
export const CONTROLLED_GOOGLE_DRIVE_MAX_BYTES = 200 * MiB

// Drive requires every non-final resumable upload request to be a multiple of
// 256 KiB. AES-GCM adds a 16-byte authentication tag to each OANIX crypto chunk,
// so choosing plaintext at 8 MiB - 16 bytes yields exactly 8 MiB ciphertext.
export const GOOGLE_DRIVE_PLAINTEXT_CHUNK_BYTES =
  DEFAULT_LARGE_OBJECT_CHUNK_BYTES - LARGE_OBJECT_AES_GCM_TAG_BYTES

if (
  (GOOGLE_DRIVE_PLAINTEXT_CHUNK_BYTES + LARGE_OBJECT_AES_GCM_TAG_BYTES) %
    LARGE_OBJECT_CHUNK_ALIGNMENT_BYTES !== 0
) {
  throw new Error('La configuración de fragmentos cifrados de Google Drive no está alineada a 256 KiB.')
}

export interface ControlledGoogleDriveTransferOptions {
  blob: Blob
  vaultKey: CryptoKey
  objectId: string
  fileName: string
  mimeType?: string
}

export interface ControlledGoogleDriveRoundTripOptions {
  blob: Blob
  vaultKey: CryptoKey
  objectId: string
  transferResult: TransferLargeObjectResult
  onProgress?: (verifiedPlaintextBytes: number, totalPlaintextBytes: number) => void
}

export function assertControlledGoogleDriveTransferSize(byteLength: number): void {
  if (!Number.isSafeInteger(byteLength)) {
    throw new Error('El tamaño del archivo de prueba no es válido.')
  }
  if (
    byteLength < CONTROLLED_GOOGLE_DRIVE_MIN_BYTES ||
    byteLength > CONTROLLED_GOOGLE_DRIVE_MAX_BYTES
  ) {
    throw new Error('La prueba controlada de Google Drive solo admite archivos entre 100 y 200 MiB.')
  }
}

function requireControlledDriveLease(): void {
  if (!hasUsableGoogleDriveAccessTokenLease()) {
    throw new Error('Conectá Google Drive antes de iniciar la prueba controlada.')
  }
}

export async function transferControlledGoogleDriveLargeObject(
  options: ControlledGoogleDriveTransferOptions,
): Promise<TransferLargeObjectResult> {
  assertControlledGoogleDriveTransferSize(options.blob.size)
  requireControlledDriveLease()

  const provider = createGoogleDriveStorageProviderFromActiveLease()
  const stateStore = new PersistentLargeObjectTransferStateStore()

  return transferLargeObject({
    blob: options.blob,
    vaultKey: options.vaultKey,
    objectId: options.objectId,
    provider,
    stateStore,
    chunkBytes: GOOGLE_DRIVE_PLAINTEXT_CHUNK_BYTES,
    ui: {
      fileName: options.fileName,
      mimeType: options.mimeType,
    },
  })
}

export async function verifyControlledGoogleDriveRoundTrip(
  options: ControlledGoogleDriveRoundTripOptions,
): Promise<VerifyLargeObjectRoundTripResult> {
  assertControlledGoogleDriveTransferSize(options.blob.size)
  requireControlledDriveLease()

  return verifyLargeObjectRoundTrip({
    blob: options.blob,
    vaultKey: options.vaultKey,
    objectId: options.objectId,
    provider: createGoogleDriveStorageProviderFromActiveLease(),
    remoteObject: options.transferResult.remoteObject,
    manifests: options.transferResult.manifests,
    onProgress: options.onProgress,
  })
}
