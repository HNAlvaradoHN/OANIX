import {
  deleteEncryptedRecord,
  listEncryptedRecords,
  writeEncryptedRecord,
} from '../../storage/repositories/encryptedRecordRepository'

const FOLDER_COVER_RECORD = 'folder-cover'
const MAX_SOURCE_BYTES = 8 * 1024 * 1024
const COVER_SIZE = 256

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

export async function prepareFolderCover(file: File): Promise<string> {
  assertImageFile(file)
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(objectUrl)
    const canvas = document.createElement('canvas')
    canvas.width = COVER_SIZE
    canvas.height = COVER_SIZE
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo preparar la miniatura.')

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight)
    const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2)
    const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2)
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      COVER_SIZE,
      COVER_SIZE,
    )

    const webp = await canvasToBlob(canvas, 'image/webp', .82)
    const output = webp ?? await canvasToBlob(canvas, 'image/jpeg', .84)
    if (!output) throw new Error('No se pudo comprimir la imagen.')
    return blobToDataUrl(output)
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
