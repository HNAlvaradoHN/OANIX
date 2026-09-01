import {
  deleteEncryptedV2Record,
  readEncryptedV2Record,
  writeEncryptedV2Record,
} from '../../storage/repositories/encryptedV2RecordRepository'

export const FOLDER_V2_COVER_TYPE = 'folder.v2.cover'
const MAX_SOURCE_BYTES = 8 * 1024 * 1024
const MAX_COVER_EDGE = 1440
const MAX_STORED_BYTES = 900 * 1024
const COVER_QUALITIES = [.84, .76, .68]

interface WorkspaceCoverRecord {
  version: 1
  assetId: string
  mimeType: string
  dataUrl: string
  updatedAt: string
}

function createAssetId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  if (!globalThis.crypto?.getRandomValues) throw new Error('No hay generación aleatoria segura disponible.')
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function assertImageFile(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Selecciona una imagen válida.')
  if (file.size <= 0) throw new Error('La imagen está vacía.')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('La imagen debe pesar 8 MiB o menos.')
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    image.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo preparar la imagen.'))
    reader.readAsDataURL(blob)
  })
}

function fittedSize(width: number, height: number) {
  if (width <= 0 || height <= 0) throw new Error('La imagen no tiene dimensiones válidas.')
  const scale = Math.min(1, MAX_COVER_EDGE / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

async function encodeCover(canvas: HTMLCanvasElement): Promise<Blob> {
  let smallest: Blob | null = null
  for (const type of ['image/webp', 'image/jpeg']) {
    for (const quality of COVER_QUALITIES) {
      const candidate = await canvasToBlob(canvas, type, quality)
      if (!candidate) continue
      if (!smallest || candidate.size < smallest.size) smallest = candidate
      if (candidate.size <= MAX_STORED_BYTES) return candidate
    }
  }
  if (!smallest) throw new Error('No se pudo comprimir la imagen.')
  return smallest
}

async function prepareCover(file: File): Promise<Blob> {
  assertImageFile(file)
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    const size = fittedSize(image.naturalWidth, image.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo preparar la imagen.')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, 0, 0, size.width, size.height)
    return encodeCover(canvas)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function saveWorkspaceFolderCover(file: File): Promise<string> {
  const blob = await prepareCover(file)
  const assetId = createAssetId()
  const record: WorkspaceCoverRecord = {
    version: 1,
    assetId,
    mimeType: blob.type,
    dataUrl: await blobToDataUrl(blob),
    updatedAt: new Date().toISOString(),
  }
  await writeEncryptedV2Record(FOLDER_V2_COVER_TYPE, assetId, record)
  return assetId
}

export async function readWorkspaceFolderCover(assetId: string): Promise<string | null> {
  if (!assetId) return null
  const record = await readEncryptedV2Record<WorkspaceCoverRecord>(FOLDER_V2_COVER_TYPE, assetId)
  if (
    !record
    || record.version !== 1
    || record.assetId !== assetId
    || !record.mimeType.startsWith('image/')
    || !record.dataUrl.startsWith('data:image/')
  ) {
    return null
  }
  return record.dataUrl
}

export function deleteWorkspaceFolderCover(assetId: string): Promise<void> {
  if (!assetId) return Promise.resolve()
  return deleteEncryptedV2Record(FOLDER_V2_COVER_TYPE, assetId)
}
