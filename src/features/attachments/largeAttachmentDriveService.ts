import { requireActiveVaultKey } from '../../security/vault/vaultSession'
import { createControlledLargeObjectId } from '../largeObjects/controlledLargeObjectIdentity'
import {
  createGoogleDriveStorageProviderFromActiveLease,
  hasUsableGoogleDriveAccessTokenLease,
} from '../largeObjects/googleDriveAccessTokenLease'
import { GOOGLE_DRIVE_PLAINTEXT_CHUNK_BYTES } from '../largeObjects/googleDriveControlledTransfer'
import { PersistentLargeObjectTransferStateStore } from '../largeObjects/persistentLargeObjectTransferStateStore'
import { transferLargeObject } from '../largeObjects/largeObjectTransferService'
import type { LargeObjectRemoteObject } from '../largeObjects/largeObjectTransferContract'
import {
  MAX_LOCAL_ATTACHMENT_BYTES,
  normalizeAttachmentMimeType,
  normalizeAttachmentName,
  type RemoteLargeAttachmentStorage,
} from './attachmentTypes'

const GiB = 1024 * 1024 * 1024
export const MAX_DRIVE_LARGE_ATTACHMENT_BYTES = 1 * GiB

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function createLargeAttachmentObjectId(noteId: string, file: File): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto no está disponible para identificar el adjunto grande.')
  }
  const fileId = await createControlledLargeObjectId(file)
  const input = new TextEncoder().encode(JSON.stringify(['OANIX', 'note-large-attachment', 1, noteId, fileId]))
  try {
    const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', input))
    try {
      return `note-file-${toHex(digest)}`
    } finally {
      digest.fill(0)
    }
  } finally {
    input.fill(0)
  }
}

function requireDriveLease(): void {
  if (!hasUsableGoogleDriveAccessTokenLease()) {
    throw new Error('Conectá Google Drive para guardar este archivo grande.')
  }
}

export function assertLargeAttachmentSize(byteLength: number): void {
  if (!Number.isSafeInteger(byteLength) || byteLength <= MAX_LOCAL_ATTACHMENT_BYTES) {
    throw new Error('Este archivo no requiere el motor de archivos grandes.')
  }
  if (byteLength > MAX_DRIVE_LARGE_ATTACHMENT_BYTES) {
    throw new Error('Por ahora los adjuntos grandes dentro de notas están habilitados hasta 1 GiB.')
  }
}

export async function uploadLargeAttachmentToDrive(
  noteId: string,
  file: File,
): Promise<RemoteLargeAttachmentStorage> {
  assertLargeAttachmentSize(file.size)
  requireDriveLease()

  const objectId = await createLargeAttachmentObjectId(noteId, file)
  const result = await transferLargeObject({
    blob: file,
    vaultKey: requireActiveVaultKey(),
    objectId,
    provider: createGoogleDriveStorageProviderFromActiveLease(),
    stateStore: new PersistentLargeObjectTransferStateStore(),
    chunkBytes: GOOGLE_DRIVE_PLAINTEXT_CHUNK_BYTES,
    ui: {
      fileName: normalizeAttachmentName(file.name),
      mimeType: normalizeAttachmentMimeType(file.type),
    },
  })

  return {
    mode: 'remote-large-v1',
    providerId: result.remoteObject.providerId,
    objectId,
    objectRef: result.remoteObject.objectRef,
    ciphertextByteLength: result.remoteObject.ciphertextByteLength,
    chunkBytes: GOOGLE_DRIVE_PLAINTEXT_CHUNK_BYTES,
    chunks: result.manifests.map((chunk) => ({ ...chunk })),
  }
}

export async function deleteLargeAttachmentFromDrive(storage: RemoteLargeAttachmentStorage): Promise<void> {
  requireDriveLease()
  const provider = createGoogleDriveStorageProviderFromActiveLease()
  if (storage.providerId !== provider.providerId) {
    throw new Error('El proveedor conectado no coincide con el adjunto remoto.')
  }
  const remoteObject: LargeObjectRemoteObject = {
    providerId: storage.providerId,
    objectRef: storage.objectRef,
    ciphertextByteLength: storage.ciphertextByteLength,
  }
  await provider.deleteRemoteObject(remoteObject)
}
