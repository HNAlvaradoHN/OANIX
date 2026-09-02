import {
  loadEncryptedAttachmentFile,
  loadEncryptedAttachments,
  removeEncryptedAttachment,
  storeEncryptedAttachment,
} from '../attachments/attachmentService'
import { isRemoteLargeAttachment } from '../attachments/attachmentTypes'
import type { EditorSurfaceAttachment } from './editorSurfaceContract'

function toSurfaceAttachment(metadata: Awaited<ReturnType<typeof loadEncryptedAttachments>>[number]): EditorSurfaceAttachment {
  return {
    id: metadata.attachmentId,
    name: metadata.name,
    mimeType: metadata.mimeType,
    byteLength: metadata.byteLength,
    createdAt: metadata.createdAt,
    remote: isRemoteLargeAttachment(metadata),
  }
}

/**
 * Application-side adapter for editor attachments.
 *
 * Visual sheets only see the generic EditorSurfaceAttachment contract. Provider
 * metadata, encrypted-record types and blob storage remain confined to the existing
 * attachments feature. Binary reads are explicit and lazy by attachment id.
 */
export function createEditorAttachmentAdapter(noteId: string) {
  return {
    async load(): Promise<EditorSurfaceAttachment[]> {
      const items = await loadEncryptedAttachments(noteId)
      return items.map(toSurfaceAttachment)
    },

    async store(file: File): Promise<EditorSurfaceAttachment> {
      return toSurfaceAttachment(await storeEncryptedAttachment(noteId, file))
    },

    async loadFile(attachmentId: string): Promise<File | null> {
      const items = await loadEncryptedAttachments(noteId)
      const metadata = items.find((item) => item.attachmentId === attachmentId)
      if (!metadata) return null
      return loadEncryptedAttachmentFile(metadata)
    },

    async remove(attachmentId: string): Promise<boolean> {
      await removeEncryptedAttachment(noteId, attachmentId)
      return true
    },
  }
}
