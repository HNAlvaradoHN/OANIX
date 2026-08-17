import { Capacitor, registerPlugin } from '@capacitor/core'
import { deleteEncryptedImage, storeEncryptedImage } from '../../features/images/imageService'
import { createNoteWithContent } from '../../features/notes/noteService'
import {
  normalizeImageMimeType,
  normalizeNoteLink,
  type NoteRecord,
  type StoredNoteBlock,
} from '../../features/notes/noteTypes'

const MAX_SHARED_IMAGE_BYTES = 50 * 1024 * 1024
const MAX_SHARED_IMAGES = 10
const MAX_SHARED_TEXT_CHARS = 250_000
const MAX_SHARED_TITLE_CHARS = 140

interface NativeSharedImage {
  uri?: string
  mimeType?: string
  name?: string
  byteLength?: number
}

interface NativeShareResult {
  available: boolean
  text?: string
  subject?: string
  images?: NativeSharedImage[]
}

interface ShareReceivedEvent {
  pending?: boolean
  queueSize?: number
}

interface NativeListenerHandle {
  remove(): Promise<void>
}

interface OanixSharePlugin {
  consumePendingShare(): Promise<NativeShareResult>
  finishShare(): Promise<{ finished: boolean }>
  addListener(
    eventName: 'shareReceived',
    listener: (event: ShareReceivedEvent) => void,
  ): Promise<NativeListenerHandle>
}

export interface AndroidShareImportProgress {
  phase: 'preparing' | 'processing-image' | 'saving-note' | 'complete'
  message: string
  percent: number
  currentImage: number
  totalImages: number
}

const nativeShare = registerPlugin<OanixSharePlugin>('OanixShare')

export function isAndroidNativeShareRuntime(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

export async function addAndroidShareReceivedListener(
  listener: () => void,
): Promise<NativeListenerHandle> {
  if (!isAndroidNativeShareRuntime()) {
    return { remove: async () => undefined }
  }
  return nativeShare.addListener('shareReceived', () => listener())
}

function createBlockId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()

  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random generation is not available in this browser.')
  }

  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function normalizeSharedText(value: unknown): string {
  if (typeof value !== 'string') return ''
  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (normalized.length > MAX_SHARED_TEXT_CHARS) {
    throw new Error('El texto compartido supera el límite seguro de OANIX.')
  }
  return normalized
}

function normalizeSharedTitle(subject: unknown): string {
  if (typeof subject !== 'string') return 'Compartido'
  const normalized = subject.trim().replace(/\s+/g, ' ')
  if (!normalized) return 'Compartido'
  return normalized.slice(0, MAX_SHARED_TITLE_CHARS)
}

function blocksForSharedText(text: string): StoredNoteBlock[] {
  if (!text) return []

  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  return paragraphs.map((paragraph) => {
    const link = normalizeNoteLink(paragraph)
    return {
      id: createBlockId(),
      type: 'paragraph' as const,
      runs: [link === paragraph ? { text: paragraph, href: link } : { text: paragraph }],
    }
  })
}

async function sharedImageToFile(image: NativeSharedImage, index: number): Promise<File> {
  const mimeType = normalizeImageMimeType(image.mimeType)
  if (!mimeType) throw new Error('OANIX recibió una imagen compartida con un formato no admitido.')

  if (
    typeof image.uri !== 'string'
    || !image.uri.startsWith('content://')
    || typeof image.byteLength !== 'number'
    || !Number.isSafeInteger(image.byteLength)
    || image.byteLength <= 0
    || image.byteLength > MAX_SHARED_IMAGE_BYTES
  ) {
    throw new Error('OANIX recibió una imagen compartida con metadatos inválidos.')
  }

  const response = await fetch(Capacitor.convertFileSrc(image.uri), { cache: 'no-store' })
  if (!response.ok) throw new Error('No se pudo leer una imagen compartida temporal.')

  const blob = await response.blob()
  if (blob.size !== image.byteLength) {
    throw new Error('Una imagen compartida quedó incompleta durante la importación.')
  }

  const fallbackExtension = mimeType === 'image/png'
    ? 'png'
    : mimeType === 'image/webp'
      ? 'webp'
      : mimeType === 'image/gif'
        ? 'gif'
        : 'jpg'
  const name = typeof image.name === 'string' && image.name.trim()
    ? image.name.trim()
    : `Imagen-compartida-${index + 1}.${fallbackExtension}`

  return new File([blob], name, {
    type: mimeType,
    lastModified: Date.now(),
  })
}

function reportProgress(
  callback: ((progress: AndroidShareImportProgress) => void) | undefined,
  progress: AndroidShareImportProgress,
) {
  callback?.(progress)
}

export async function importPendingAndroidShare(
  onProgress?: (progress: AndroidShareImportProgress) => void,
): Promise<NoteRecord | null> {
  if (!isAndroidNativeShareRuntime()) return null

  const encryptedImageIds: string[] = []

  reportProgress(onProgress, {
    phase: 'preparing',
    message: 'Preparando contenido compartido…',
    percent: 6,
    currentImage: 0,
    totalImages: 0,
  })

  try {
    const result = await nativeShare.consumePendingShare()
    if (!result.available) return null

    const text = normalizeSharedText(result.text)
    const images = Array.isArray(result.images) ? result.images : []
    if (images.length > MAX_SHARED_IMAGES) {
      throw new Error('Se compartieron demasiadas imágenes a la vez. OANIX admite hasta 10 por envío.')
    }

    const blocks: StoredNoteBlock[] = blocksForSharedText(text)
    const imageProgressSpan = 78

    for (let index = 0; index < images.length; index += 1) {
      const currentImage = index + 1
      const beforePercent = 10 + Math.floor((index / Math.max(1, images.length)) * imageProgressSpan)
      reportProgress(onProgress, {
        phase: 'processing-image',
        message: `Procesando foto ${currentImage} de ${images.length}…`,
        percent: beforePercent,
        currentImage,
        totalImages: images.length,
      })

      const file = await sharedImageToFile(images[index], index)
      const stored = await storeEncryptedImage(file)
      encryptedImageIds.push(stored.imageId)
      blocks.push({
        id: createBlockId(),
        type: 'image',
        imageId: stored.imageId,
        mimeType: stored.mimeType,
        name: stored.name,
        byteLength: stored.byteLength,
      })

      reportProgress(onProgress, {
        phase: 'processing-image',
        message: `Foto ${currentImage} de ${images.length} lista`,
        percent: 10 + Math.floor((currentImage / Math.max(1, images.length)) * imageProgressSpan),
        currentImage,
        totalImages: images.length,
      })
    }

    if (blocks.length === 0) return null

    reportProgress(onProgress, {
      phase: 'saving-note',
      message: images.length > 0 ? 'Guardando la nota cifrada…' : 'Guardando contenido compartido…',
      percent: 94,
      currentImage: images.length,
      totalImages: images.length,
    })

    const note = await createNoteWithContent(normalizeSharedTitle(result.subject), blocks)

    reportProgress(onProgress, {
      phase: 'complete',
      message: 'Contenido listo',
      percent: 100,
      currentImage: images.length,
      totalImages: images.length,
    })

    return note
  } catch (error) {
    await Promise.allSettled(encryptedImageIds.map((imageId) => deleteEncryptedImage(imageId)))
    throw error
  } finally {
    try {
      await nativeShare.finishShare()
    } catch {
      // The native plugin also removes abandoned share-cache files on a later startup.
    }
  }
}
