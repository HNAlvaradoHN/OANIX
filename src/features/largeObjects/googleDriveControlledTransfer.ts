import { createGoogleDriveStorageProviderFromActiveLease, hasUsableGoogleDriveAccessTokenLease } from './googleDriveAccessTokenLease.ts'
import { PersistentLargeObjectTransferStateStore } from './persistentLargeObjectTransferStateStore.ts'
import {
  transferLargeObject,
  type TransferLargeObjectResult,
} from './largeObjectTransferService.ts'

const MiB = 1024 * 1024

export const CONTROLLED_GOOGLE_DRIVE_MIN_BYTES = 100 * MiB
export const CONTROLLED_GOOGLE_DRIVE_MAX_BYTES = 200 * MiB

export interface ControlledGoogleDriveTransferOptions {
  blob: Blob
  vaultKey: CryptoKey
  objectId: string
  fileName: string
  mimeType?: string
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

export async function transferControlledGoogleDriveLargeObject(
  options: ControlledGoogleDriveTransferOptions,
): Promise<TransferLargeObjectResult> {
  assertControlledGoogleDriveTransferSize(options.blob.size)

  if (!hasUsableGoogleDriveAccessTokenLease()) {
    throw new Error('Conectá Google Drive antes de iniciar la prueba controlada.')
  }

  const provider = createGoogleDriveStorageProviderFromActiveLease()
  const stateStore = new PersistentLargeObjectTransferStateStore()

  return transferLargeObject({
    blob: options.blob,
    vaultKey: options.vaultKey,
    objectId: options.objectId,
    provider,
    stateStore,
    ui: {
      fileName: options.fileName,
      mimeType: options.mimeType,
    },
  })
}
