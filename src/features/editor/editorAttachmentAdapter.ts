import {
  loadEncryptedAttachmentFile,
  loadEncryptedAttachments,
  removeEncryptedAttachment,
  storeEncryptedAttachment,
} from '../attachments/attachmentService'
import type { AttachmentMetadata } from '../attachments/attachmentTypes'
import type { EditorSurfaceAttachment } from './editorSurfaceContract'

/**
 * Converts OANIX attachment metadata into the deliberately smaller editor contract.
 * Provider/storage information never crosses the EditorSurface boundary.
 */
export function toEditorSurfaceAttachment(metadata: AttachmentMetadata): EditorSurfaceAttachment {
  return {
    id: metadata.attachmentId,
    name: metadata.name,
    mimeType: metadata.mimeType,
    byteLength: metadata.byteLength,
    createdAt: metadata.createdAt,
    remote: metadata.storage?.mode === 'remote-large-v1',
  }
}

export async function loadEditorSurfaceAttachments(noteId: string): Promise<EditorSurfaceAttachment[]> {
  const items = await loadEncryptedAttachments(noteId)
  return items.map(toEditorSurfaceAttachment)
}

export async function storeEditorSurfaceAttachment(
  noteId: string,
  file: File,
): Promise<EditorSurfaceAttachment> {
  return toEditorSurfaceAttachment(await storeEncryptedAttachment(noteId, file))
}

export async function loadEditorSurfaceAttachmentFile(
  noteId: string,
  attachmentId: string,
): Promise<File | null> {
  const metadata = (await loadEncryptedAttachments(noteId))
    .find((item) => item.attachmentId === attachmentId)
  if (!metadata) return null
  return loadEncryptedAttachmentFile(metadata)
}

export async function removeEditorSurfaceAttachment(
  noteId: string,
  attachmentId: string,
): Promise<boolean> {
  await removeEncryptedAttachment(noteId, attachmentId)
  return true
}
