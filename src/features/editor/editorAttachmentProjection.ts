import type { AttachmentMetadata } from '../attachments/attachmentTypes.ts'
import type { EditorSurfaceAttachment } from './editorSurfaceContract.ts'

/**
 * Pure metadata projection for the EditorSurface boundary.
 * Keeping this independent from storage makes the boundary cheap to test and keeps
 * provider/storage details out of every visual sheet implementation.
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
