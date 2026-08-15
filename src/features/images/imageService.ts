import { readEncryptedBlob, writeEncryptedBlob } from '../../storage/repositories/encryptedBlobRepository'

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number]

const IMAGE_RECORD_TYPE = 'image'
const MAX_IMAGE_BYTES = 15 * 1024 * 1024

export interface StoredImageInfo {
  imageId: string
  mimeType: ImageMimeType
  name: string
  byteLength: number
}

function createImageId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()

  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random generation is not available in this browser.')
  }

  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function normalizeImageMimeType(value: string): ImageMimeType | null {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(value) ? (value as ImageMimeType) : null
}

export function validateImageFile(file: File): ImageMimeType {
  const mimeType = normalizeImageMimeType(file.type)
  if (!mimeType) {
    throw new Error('OANIX admite imágenes JPEG, PNG, WebP o GIF en esta etapa.')
  }

  if (file.size <= 0) {
    throw new Error('La imagen está vacía.')
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('La imagen supera el límite inicial de 15 MB.')
  }

  return mimeType
}

export async function storeEncryptedImage(file: File): Promise<StoredImageInfo> {
  const mimeType = validateImageFile(file)
  const imageId = createImageId()
  const bytes = new Uint8Array(await file.arrayBuffer())

  await writeEncryptedBlob(IMAGE_RECORD_TYPE, imageId, bytes)

  return {
    imageId,
    mimeType,
    name: file.name.trim() || 'Imagen',
    byteLength: bytes.byteLength,
  }
}

export async function loadEncryptedImage(imageId: string, mimeType: ImageMimeType): Promise<Blob | null> {
  const bytes = await readEncryptedBlob(IMAGE_RECORD_TYPE, imageId)
  if (!bytes) return null
  return new Blob([Uint8Array.from(bytes)], { type: mimeType })
}
