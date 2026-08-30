import {
  loadEncryptedAttachmentFile,
  loadEncryptedAttachments,
  removeEncryptedAttachment,
  storeEncryptedAttachment,
} from '../attachments/attachmentService'
import { exportRemoteLargeAttachment } from '../attachments/largeAttachmentExportService'
import {
  attachmentKind,
  isRemoteLargeAttachment,
  type AttachmentMetadata,
} from '../attachments/attachmentTypes'
import {
  loadEncryptedImage,
  storeEncryptedImage,
  type StoredImageInfo,
} from '../images/imageService'
import type { ImageBlock } from './noteTypes'

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.name
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function openFile(file: File): void {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.target = '_blank'
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function shareOrDownload(file: File): Promise<void> {
  const data: ShareData = { files: [file], title: file.name }
  if (
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare(data)
  ) {
    try {
      await navigator.share(data)
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }
  downloadFile(file)
}

export function loadNativeNoteSheetImage(block: ImageBlock): Promise<Blob | null> {
  return loadEncryptedImage(block.imageId, block.mimeType)
}

export function storeNativeNoteSheetImage(file: File): Promise<StoredImageInfo> {
  return storeEncryptedImage(file)
}

export function loadNativeNoteSheetAttachments(noteId: string): Promise<AttachmentMetadata[]> {
  return loadEncryptedAttachments(noteId)
}

export async function storeNativeNoteSheetAttachments(
  noteId: string,
  files: File[],
): Promise<AttachmentMetadata[]> {
  const stored: AttachmentMetadata[] = []
  for (const file of files) stored.push(await storeEncryptedAttachment(noteId, file))
  return stored
}

export function removeNativeNoteSheetAttachment(
  noteId: string,
  attachment: AttachmentMetadata,
): Promise<void> {
  return removeEncryptedAttachment(noteId, attachment.attachmentId)
}

export async function openNativeNoteSheetAttachment(attachment: AttachmentMetadata): Promise<void> {
  if (isRemoteLargeAttachment(attachment)) {
    await exportRemoteLargeAttachment(attachment, { openAfterSave: true })
    return
  }

  const file = await loadEncryptedAttachmentFile(attachment)
  if (!file) throw new Error('El archivo cifrado no está disponible en este dispositivo.')

  const previewable = ['pdf', 'image', 'video', 'audio', 'text'].includes(attachmentKind(attachment))
  if (previewable) openFile(file)
  else await shareOrDownload(file)
}

export async function downloadNativeNoteSheetAttachment(attachment: AttachmentMetadata): Promise<void> {
  if (isRemoteLargeAttachment(attachment)) {
    await exportRemoteLargeAttachment(attachment)
    return
  }

  const file = await loadEncryptedAttachmentFile(attachment)
  if (!file) throw new Error('El archivo cifrado no está disponible en este dispositivo.')
  downloadFile(file)
}
