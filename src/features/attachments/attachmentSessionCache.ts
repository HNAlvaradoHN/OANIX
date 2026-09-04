import { registerVaultSessionCleanup } from '../../security/vault/vaultSession.ts'
import type { AttachmentMetadata } from './attachmentTypes.ts'

export const DEFAULT_DECRYPTED_ATTACHMENT_CACHE_BYTES = 48 * 1024 * 1024

interface CachedFileEntry {
  file: File
  byteLength: number
  objectUrl: string | null
}

export class AttachmentSessionCache {
  private readonly files = new Map<string, CachedFileEntry>()
  private readonly metadataByNote = new Map<string, AttachmentMetadata[]>()
  private cachedFileBytes = 0
  private readonly maxFileBytes: number

  constructor(maxFileBytes = DEFAULT_DECRYPTED_ATTACHMENT_CACHE_BYTES) {
    this.maxFileBytes = maxFileBytes
  }

  private touch(attachmentId: string, existing: CachedFileEntry): void {
    this.files.delete(attachmentId)
    this.files.set(attachmentId, existing)
  }

  private revokeObjectUrl(existing: CachedFileEntry | undefined): void {
    if (!existing?.objectUrl) return
    URL.revokeObjectURL(existing.objectUrl)
    existing.objectUrl = null
  }

  getFile(attachmentId: string): File | null {
    const existing = this.files.get(attachmentId)
    if (!existing) return null
    this.touch(attachmentId, existing)
    return existing.file
  }

  getObjectUrl(attachmentId: string): string | null {
    const existing = this.files.get(attachmentId)
    if (!existing) return null
    this.touch(attachmentId, existing)
    if (!existing.objectUrl) existing.objectUrl = URL.createObjectURL(existing.file)
    return existing.objectUrl
  }

  putFile(attachmentId: string, file: File): void {
    if (!attachmentId || file.size <= 0 || file.size > this.maxFileBytes) return

    const existing = this.files.get(attachmentId)
    if (existing) {
      this.revokeObjectUrl(existing)
      this.cachedFileBytes -= existing.byteLength
      this.files.delete(attachmentId)
    }

    while (this.cachedFileBytes + file.size > this.maxFileBytes && this.files.size > 0) {
      const oldestId = this.files.keys().next().value as string | undefined
      if (!oldestId) break
      const oldest = this.files.get(oldestId)
      this.revokeObjectUrl(oldest)
      this.files.delete(oldestId)
      if (oldest) this.cachedFileBytes -= oldest.byteLength
    }

    this.files.set(attachmentId, { file, byteLength: file.size, objectUrl: null })
    this.cachedFileBytes += file.size
  }

  removeFile(attachmentId: string): void {
    const existing = this.files.get(attachmentId)
    if (!existing) return
    this.revokeObjectUrl(existing)
    this.files.delete(attachmentId)
    this.cachedFileBytes -= existing.byteLength
  }

  getMetadata(noteId: string): AttachmentMetadata[] | null {
    const items = this.metadataByNote.get(noteId)
    return items ? items.map((item) => ({ ...item })) : null
  }

  setMetadata(noteId: string, items: readonly AttachmentMetadata[]): void {
    this.metadataByNote.set(noteId, items.map((item) => ({ ...item })))
  }

  removeNote(noteId: string): void {
    const items = this.metadataByNote.get(noteId)
    if (items) {
      for (const item of items) this.removeFile(item.attachmentId)
    }
    this.metadataByNote.delete(noteId)
  }

  clear(): void {
    for (const existing of this.files.values()) this.revokeObjectUrl(existing)
    this.files.clear()
    this.metadataByNote.clear()
    this.cachedFileBytes = 0
  }
}

const attachmentSessionCache = new AttachmentSessionCache()
registerVaultSessionCleanup(() => attachmentSessionCache.clear())

export function getCachedAttachmentFile(attachmentId: string): File | null {
  return attachmentSessionCache.getFile(attachmentId)
}

export function getCachedAttachmentObjectUrl(attachmentId: string): string | null {
  return attachmentSessionCache.getObjectUrl(attachmentId)
}

export function cacheAttachmentFile(attachmentId: string, file: File): void {
  attachmentSessionCache.putFile(attachmentId, file)
}

export function evictCachedAttachmentFile(attachmentId: string): void {
  attachmentSessionCache.removeFile(attachmentId)
}

export function getCachedAttachmentMetadata(noteId: string): AttachmentMetadata[] | null {
  return attachmentSessionCache.getMetadata(noteId)
}

export function cacheAttachmentMetadata(noteId: string, items: readonly AttachmentMetadata[]): void {
  attachmentSessionCache.setMetadata(noteId, items)
}

export function evictCachedAttachmentNote(noteId: string): void {
  attachmentSessionCache.removeNote(noteId)
}

export function clearAttachmentSessionCache(): void {
  attachmentSessionCache.clear()
}
