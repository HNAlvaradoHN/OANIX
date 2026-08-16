import {
  deleteEncryptedBlob,
  hasEncryptedBlob,
  readEncryptedBlob,
  writeEncryptedBlob,
} from '../../storage/repositories/encryptedBlobRepository'
import {
  normalizeImageMimeType,
  type ImageMimeType,
} from '../notes/noteTypes'

const IMAGE_RECORD_TYPE = 'image'
const IMAGE_PREVIEW_RECORD_TYPE = 'image-preview'
const MAX_IMAGE_BYTES = 50 * 1024 * 1024
const MAX_PREVIEW_EDGE = 1600
const PREVIEW_QUALITY = 0.82

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

function previewMimeTypeFor(mimeType: ImageMimeType): 'image/jpeg' | 'image/png' {
  return mimeType === 'image/png' || mimeType === 'image/webp' ? 'image/png' : 'image/jpeg'
}

async function createPreviewBlob(source: Blob, mimeType: ImageMimeType): Promise<Blob | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(source)
    if (bitmap.width <= 0 || bitmap.height <= 0) return null

    const scale = Math.min(1, MAX_PREVIEW_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d', { alpha: true })
    if (!context) return null
    context.drawImage(bitmap, 0, 0, width, height)

    const previewType = previewMimeTypeFor(mimeType)
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, previewType, previewType === 'image/jpeg' ? PREVIEW_QUALITY : undefined)
    })
  } catch {
    return null
  } finally {
    bitmap?.close()
  }
}

async function storePreviewIfUseful(
  imageId: string,
  source: Blob,
  mimeType: ImageMimeType,
): Promise<Blob | null> {
  const preview = await createPreviewBlob(source, mimeType)
  if (!preview || preview.size <= 0 || preview.size >= source.size) return null

  const bytes = new Uint8Array(await preview.arrayBuffer())
  await writeEncryptedBlob(IMAGE_PREVIEW_RECORD_TYPE, imageId, bytes)
  return preview
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
    throw new Error('La imagen supera el límite de 50 MB para conservar el original en V1.')
  }

  return mimeType
}

export async function storeEncryptedImage(file: File): Promise<StoredImageInfo> {
  const mimeType = validateImageFile(file)
  const imageId = createImageId()
  const bytes = new Uint8Array(await file.arrayBuffer())

  await writeEncryptedBlob(IMAGE_RECORD_TYPE, imageId, bytes)

  try {
    await storePreviewIfUseful(imageId, file, mimeType)
  } catch {
    // The encrypted original is authoritative. Preview creation is an optimization only.
  }

  return {
    imageId,
    mimeType,
    name: file.name.trim() || 'Imagen',
    byteLength: bytes.byteLength,
  }
}

export function hasEncryptedImage(imageId: string): Promise<boolean> {
  return hasEncryptedBlob(IMAGE_RECORD_TYPE, imageId)
}

export async function loadEncryptedImage(imageId: string, mimeType: ImageMimeType): Promise<Blob | null> {
  const bytes = await readEncryptedBlob(IMAGE_RECORD_TYPE, imageId)
  if (!bytes) return null
  return new Blob([Uint8Array.from(bytes)], { type: mimeType })
}

export async function loadEncryptedImagePreview(
  imageId: string,
  mimeType: ImageMimeType,
): Promise<Blob | null> {
  const previewBytes = await readEncryptedBlob(IMAGE_PREVIEW_RECORD_TYPE, imageId)
  if (previewBytes) {
    return new Blob([Uint8Array.from(previewBytes)], { type: previewMimeTypeFor(mimeType) })
  }

  const originalBytes = await readEncryptedBlob(IMAGE_RECORD_TYPE, imageId)
  if (!originalBytes) return null
  const original = new Blob([Uint8Array.from(originalBytes)], { type: mimeType })

  try {
    return (await storePreviewIfUseful(imageId, original, mimeType)) ?? original
  } catch {
    return original
  }
}

export async function deleteEncryptedImage(imageId: string): Promise<void> {
  await Promise.all([
    deleteEncryptedBlob(IMAGE_RECORD_TYPE, imageId),
    deleteEncryptedBlob(IMAGE_PREVIEW_RECORD_TYPE, imageId),
  ])
}
