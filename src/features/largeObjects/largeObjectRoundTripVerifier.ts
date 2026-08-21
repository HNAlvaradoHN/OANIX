import { decryptLargeObjectChunk } from './largeObjectChunkCrypto.ts'
import type { LargeObjectChunkManifest } from './largeObjectProtocol.ts'
import type { LargeObjectRemoteObject, OanixStorageProvider } from './largeObjectTransferContract.ts'

export interface VerifyLargeObjectRoundTripOptions {
  blob: Blob
  vaultKey: CryptoKey
  objectId: string
  provider: OanixStorageProvider
  remoteObject: LargeObjectRemoteObject
  manifests: LargeObjectChunkManifest[]
  onProgress?: (verifiedPlaintextBytes: number, totalPlaintextBytes: number) => void
}

export interface VerifyLargeObjectRoundTripResult {
  verifiedPlaintextBytes: number
  verifiedCiphertextBytes: number
  chunkCount: number
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false
  let difference = 0
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index] ^ right[index]
  }
  return difference === 0
}

export async function verifyLargeObjectRoundTrip(
  options: VerifyLargeObjectRoundTripOptions,
): Promise<VerifyLargeObjectRoundTripResult> {
  if (options.blob.size <= 0) throw new Error('El archivo original de verificación no puede estar vacío.')
  if (options.remoteObject.providerId !== options.provider.providerId) {
    throw new Error('El objeto remoto pertenece a otro proveedor de almacenamiento.')
  }
  if (options.manifests.length === 0) {
    throw new Error('No existen manifiestos criptográficos para verificar el archivo remoto.')
  }

  let expectedPlaintextOffset = 0
  let ciphertextOffset = 0
  let verifiedPlaintextBytes = 0

  options.onProgress?.(0, options.blob.size)

  for (let index = 0; index < options.manifests.length; index += 1) {
    const manifest = options.manifests[index]
    if (
      manifest.index !== index ||
      manifest.plaintextOffset !== expectedPlaintextOffset ||
      !Number.isSafeInteger(manifest.plaintextLength) ||
      manifest.plaintextLength <= 0 ||
      !Number.isSafeInteger(manifest.ciphertextByteLength) ||
      manifest.ciphertextByteLength <= manifest.plaintextLength ||
      expectedPlaintextOffset + manifest.plaintextLength > options.blob.size
    ) {
      throw new Error('Los manifiestos criptográficos no describen el archivo original de forma contigua.')
    }

    let ciphertext: Uint8Array | null = null
    let plaintext: Uint8Array | null = null
    let original: Uint8Array | null = null

    try {
      ciphertext = await options.provider.downloadCiphertextRange({
        remoteObject: options.remoteObject,
        ciphertextOffset,
        ciphertextByteLength: manifest.ciphertextByteLength,
      })
      plaintext = await decryptLargeObjectChunk(
        options.vaultKey,
        options.objectId,
        manifest,
        ciphertext,
      )
      original = new Uint8Array(await options.blob.slice(
        manifest.plaintextOffset,
        manifest.plaintextOffset + manifest.plaintextLength,
      ).arrayBuffer())

      if (!bytesEqual(plaintext, original)) {
        throw new Error('El fragmento recuperado no coincide con el archivo original seleccionado.')
      }
    } finally {
      ciphertext?.fill(0)
      plaintext?.fill(0)
      original?.fill(0)
    }

    ciphertextOffset += manifest.ciphertextByteLength
    expectedPlaintextOffset += manifest.plaintextLength
    verifiedPlaintextBytes = expectedPlaintextOffset
    options.onProgress?.(verifiedPlaintextBytes, options.blob.size)
  }

  if (verifiedPlaintextBytes !== options.blob.size) {
    throw new Error('La verificación no reconstruyó todos los bytes del archivo original.')
  }
  if (ciphertextOffset !== options.remoteObject.ciphertextByteLength) {
    throw new Error('La longitud cifrada verificada no coincide con el objeto remoto almacenado.')
  }

  return {
    verifiedPlaintextBytes,
    verifiedCiphertextBytes: ciphertextOffset,
    chunkCount: options.manifests.length,
  }
}
