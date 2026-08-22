import { requireActiveVaultKey } from '../../security/vault/vaultSession'
import { createControlledLargeObjectId } from '../largeObjects/controlledLargeObjectIdentity'
import { createGoogleDriveStorageProviderFromActiveLease } from '../largeObjects/googleDriveAccessTokenLease'
import { GOOGLE_DRIVE_PLAINTEXT_CHUNK_BYTES } from '../largeObjects/googleDriveControlledTransfer'
import { decryptLargeObjectChunk } from '../largeObjects/largeObjectChunkCrypto'
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

export interface RecoverLargeAttachmentProgress {
  recoveredPlaintextBytes: number
  totalPlaintextBytes: number
  percent: number
}

export async function recoverLargeAttachmentFromDrive(
  storage: RemoteLargeAttachmentStorage,
  expectedPlaintextBytes: number,
  consumePlaintextChunk: (bytes: Uint8Array, index: number) => Promise<void>,
  onProgress?: (progress: RecoverLargeAttachmentProgress) => void,
): Promise<void> {
  assertLargeAttachmentSize(expectedPlaintextBytes)
  if (storage.chunks.length === 0) throw new Error('El adjunto remoto no contiene manifiestos cifrados.')

  const provider = createGoogleDriveStorageProviderFromActiveLease()
  if (storage.providerId !== provider.providerId) {
    throw new Error('El proveedor conectado no coincide con el adjunto remoto.')
  }

  const remoteObject: LargeObjectRemoteObject = {
    providerId: storage.providerId,
    objectRef: storage.objectRef,
    ciphertextByteLength: storage.ciphertextByteLength,
  }
  const vaultKey = requireActiveVaultKey()
  let expectedPlaintextOffset = 0
  let ciphertextOffset = 0

  onProgress?.({ recoveredPlaintextBytes: 0, totalPlaintextBytes: expectedPlaintextBytes, percent: 0 })

  for (let index = 0; index < storage.chunks.length; index += 1) {
    const manifest = storage.chunks[index]
    if (
      manifest.index !== index ||
      manifest.plaintextOffset !== expectedPlaintextOffset ||
      manifest.plaintextLength <= 0 ||
      manifest.ciphertextByteLength <= manifest.plaintextLength ||
      expectedPlaintextOffset + manifest.plaintextLength > expectedPlaintextBytes ||
      ciphertextOffset + manifest.ciphertextByteLength > storage.ciphertextByteLength
    ) {
      throw new Error('Los manifiestos del adjunto remoto no son contiguos o están dañados.')
    }

    let ciphertext: Uint8Array | null = null
    let plaintext: Uint8Array | null = null
    try {
      ciphertext = await provider.downloadCiphertextRange({
        remoteObject,
        ciphertextOffset,
        ciphertextByteLength: manifest.ciphertextByteLength,
      })
      plaintext = await decryptLargeObjectChunk(vaultKey, storage.objectId, manifest, ciphertext)
      await consumePlaintextChunk(plaintext, index)
    } finally {
      ciphertext?.fill(0)
      plaintext?.fill(0)
    }

    expectedPlaintextOffset += manifest.plaintextLength
    ciphertextOffset += manifest.ciphertextByteLength
    onProgress?.({
      recoveredPlaintextBytes: expectedPlaintextOffset,
      totalPlaintextBytes: expectedPlaintextBytes,
      percent: Math.min(100, Math.round((expectedPlaintextOffset / expectedPlaintextBytes) * 100)),
    })
  }

  if (expectedPlaintextOffset !== expectedPlaintextBytes) {
    throw new Error('La recuperación no reconstruyó todos los bytes del archivo original.')
  }
  if (ciphertextOffset !== storage.ciphertextByteLength) {
    throw new Error('La recuperación no consumió todo el objeto cifrado remoto.')
  }
}

export async function deleteLargeAttachmentFromDrive(storage: RemoteLargeAttachmentStorage): Promise<void> {
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
