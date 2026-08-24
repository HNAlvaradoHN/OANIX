import {
  deleteEncryptedRecord,
  listEncryptedRecords,
  writeEncryptedRecord,
} from '../../storage/repositories/encryptedRecordRepository'

const FOLDER_COVER_RECORD = 'folder-cover'
const MAX_SOURCE_BYTES = 8 * 1024 * 1024
const MAX_COVER_EDGE = 1440
const MAX_STORED_BYTES = 900 * 1024
const COVER_QUALITIES = [.84, .76, .68]

export interface FolderCoverRecord {
  version: 1
  folderId: string
  dataUrl: string
  updatedAt: string
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

function fittedCoverSize(width: number, height: number) {
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

export async function prepareFolderCover(file: File): Promise<string> {
  assertImageFile(file)
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(objectUrl)
    const size = fittedCoverSize(image.naturalWidth, image.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo preparar la imagen.')

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      image,
      0,
      0,
      image.naturalWidth,
      image.naturalHeight,
      0,
      0,
      size.width,
      size.height,
    )

    return blobToDataUrl(await encodeCover(canvas))
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function loadFolderCovers(): Promise<Map<string, string>> {
  const records = await listEncryptedRecords<FolderCoverRecord>(FOLDER_COVER_RECORD)
  const covers = new Map<string, string>()

  for (const record of records) {
    const value = record.value
    if (
      value?.version === 1
      && value.folderId === record.recordId
      && typeof value.dataUrl === 'string'
      && value.dataUrl.startsWith('data:image/')
    ) {
      covers.set(value.folderId, value.dataUrl)
    }
  }

  return covers
}

export async function saveFolderCover(folderId: string, dataUrl: string): Promise<void> {
  const record: FolderCoverRecord = {
    version: 1,
    folderId,
    dataUrl,
    updatedAt: new Date().toISOString(),
  }
  await writeEncryptedRecord(FOLDER_COVER_RECORD, folderId, record)
}

export function removeFolderCover(folderId: string): Promise<void> {
  return deleteEncryptedRecord(FOLDER_COVER_RECORD, folderId)
}
