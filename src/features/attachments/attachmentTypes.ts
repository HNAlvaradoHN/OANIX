import { MAX_LARGE_OBJECT_BYTES, type LargeObjectChunkManifest } from '../largeObjects/largeObjectProtocol.ts'

export const MAX_LOCAL_ATTACHMENT_BYTES = 50 * 1024 * 1024
export const MAX_ATTACHMENT_BYTES = MAX_LARGE_OBJECT_BYTES
export const DEFAULT_ATTACHMENT_MIME_TYPE = 'application/octet-stream'

export type AttachmentKind =
  | 'pdf'
  | 'document'
  | 'spreadsheet'
  | 'archive'
  | 'apk'
  | 'image'
  | 'video'
  | 'audio'
  | 'text'
  | 'file'

export interface RemoteLargeAttachmentStorage {
  mode: 'remote-large-v1'
  providerId: string
  objectId: string
  objectRef: string
  ciphertextByteLength: number
  chunkBytes: number
  chunks: LargeObjectChunkManifest[]
}

export interface AttachmentMetadata {
  attachmentId: string
  name: string
  mimeType: string
  byteLength: number
  createdAt: string
  storage?: RemoteLargeAttachmentStorage
}

export interface AttachmentIndex {
  version: 1
  noteId: string
  items: AttachmentMetadata[]
}

export interface AttachmentCandidate {
  name: string
  type?: string | null
  size: number
}

function extensionOf(name: string): string {
  const normalized = name.trim().toLowerCase()
  const lastDot = normalized.lastIndexOf('.')
  return lastDot >= 0 ? normalized.slice(lastDot + 1) : ''
}

export function normalizeAttachmentName(name: string): string {
  const safe = name
    .replace(/[\u0000-\u001f\u007f/\\]/g, '_')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 180)
  return safe || 'Archivo'
}

export function normalizeAttachmentMimeType(value?: string | null): string {
  const normalized = (value ?? '').trim().toLowerCase().slice(0, 120)
  return normalized || DEFAULT_ATTACHMENT_MIME_TYPE
}

export function validateAttachmentCandidate(candidate: AttachmentCandidate): {
  name: string
  mimeType: string
  byteLength: number
} {
  if (!Number.isSafeInteger(candidate.size) || candidate.size <= 0) {
    throw new Error('El archivo está vacío o tiene un tamaño no válido.')
  }
  if (candidate.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('El archivo supera el límite de seguridad actual de OANIX para archivos grandes.')
  }

  return {
    name: normalizeAttachmentName(candidate.name),
    mimeType: normalizeAttachmentMimeType(candidate.type),
    byteLength: candidate.size,
  }
}

function isChunkManifest(value: unknown): value is LargeObjectChunkManifest {
  if (!value || typeof value !== 'object') return false
  const chunk = value as Partial<LargeObjectChunkManifest>
  return (
    Number.isSafeInteger(chunk.index) && Number(chunk.index) >= 0 &&
    Number.isSafeInteger(chunk.plaintextOffset) && Number(chunk.plaintextOffset) >= 0 &&
    Number.isSafeInteger(chunk.plaintextLength) && Number(chunk.plaintextLength) > 0 &&
    Number.isSafeInteger(chunk.ciphertextByteLength) && Number(chunk.ciphertextByteLength) > Number(chunk.plaintextLength) &&
    typeof chunk.iv === 'string' && chunk.iv.length > 0 &&
    typeof chunk.sha256 === 'string' && chunk.sha256.length > 0
  )
}

function isRemoteLargeAttachmentStorage(value: unknown): value is RemoteLargeAttachmentStorage {
  if (!value || typeof value !== 'object') return false
  const storage = value as Partial<RemoteLargeAttachmentStorage>
  return (
    storage.mode === 'remote-large-v1' &&
    typeof storage.providerId === 'string' && storage.providerId.length > 0 &&
    typeof storage.objectId === 'string' && storage.objectId.length >= 8 && storage.objectId.length <= 120 &&
    typeof storage.objectRef === 'string' && storage.objectRef.length > 0 &&
    Number.isSafeInteger(storage.ciphertextByteLength) && Number(storage.ciphertextByteLength) > 0 &&
    Number.isSafeInteger(storage.chunkBytes) && Number(storage.chunkBytes) > 0 &&
    Array.isArray(storage.chunks) && storage.chunks.length > 0 && storage.chunks.every(isChunkManifest)
  )
}

export function isAttachmentMetadata(value: unknown): value is AttachmentMetadata {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<AttachmentMetadata>
  const baseValid = (
    typeof item.attachmentId === 'string' && item.attachmentId.length > 0 &&
    typeof item.name === 'string' && item.name.length > 0 && item.name.length <= 180 &&
    typeof item.mimeType === 'string' && item.mimeType.length > 0 && item.mimeType.length <= 120 &&
    typeof item.byteLength === 'number' && Number.isSafeInteger(item.byteLength) &&
    item.byteLength > 0 && item.byteLength <= MAX_ATTACHMENT_BYTES &&
    typeof item.createdAt === 'string' && item.createdAt.length > 0 &&
    Number.isFinite(Date.parse(item.createdAt))
  )
  if (!baseValid) return false
  if (item.storage === undefined) return item.byteLength <= MAX_LOCAL_ATTACHMENT_BYTES
  return item.byteLength > MAX_LOCAL_ATTACHMENT_BYTES && isRemoteLargeAttachmentStorage(item.storage)
}

export function isAttachmentIndex(value: unknown, noteId: string): value is AttachmentIndex {
  if (!value || typeof value !== 'object') return false
  const index = value as Partial<AttachmentIndex>
  if (index.version !== 1 || index.noteId !== noteId || !Array.isArray(index.items)) return false
  const seen = new Set<string>()
  return index.items.every((item) => {
    if (!isAttachmentMetadata(item) || seen.has(item.attachmentId)) return false
    seen.add(item.attachmentId)
    return true
  })
}

export function isRemoteLargeAttachment(item: AttachmentMetadata): boolean {
  return item.storage?.mode === 'remote-large-v1'
}

export function attachmentKind(item: Pick<AttachmentMetadata, 'name' | 'mimeType'>): AttachmentKind {
  const extension = extensionOf(item.name)
  const mime = item.mimeType.toLowerCase()

  if (extension === 'apk' || mime === 'application/vnd.android.package-archive') return 'apk'
  if (mime === 'application/pdf' || extension === 'pdf') return 'pdf'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('text/') || ['txt', 'md', 'csv', 'json', 'xml'].includes(extension)) return 'text'
  if (
    mime.includes('word') || mime.includes('officedocument.wordprocessingml') ||
    ['doc', 'docx', 'odt', 'rtf'].includes(extension)
  ) return 'document'
  if (
    mime.includes('excel') || mime.includes('spreadsheet') ||
    ['xls', 'xlsx', 'ods'].includes(extension)
  ) return 'spreadsheet'
  if (
    mime.includes('zip') || mime.includes('compressed') || mime.includes('archive') ||
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(extension)
  ) return 'archive'
  return 'file'
}

export function attachmentIcon(item: Pick<AttachmentMetadata, 'name' | 'mimeType'>): string {
  switch (attachmentKind(item)) {
    case 'pdf': return '📄'
    case 'document': return '📝'
    case 'spreadsheet': return '📊'
    case 'archive': return '📦'
    case 'apk': return '📱'
    case 'image': return '🖼️'
    case 'video': return '🎥'
    case 'audio': return '🎵'
    case 'text': return '📃'
    default: return '📎'
  }
}

export function formatAttachmentSize(byteLength: number): string {
  if (byteLength < 1024) return `${byteLength} B`
  if (byteLength < 1024 * 1024) return `${Math.max(1, Math.round(byteLength / 1024))} KB`
  if (byteLength < 1024 * 1024 * 1024) return `${(byteLength / (1024 * 1024)).toFixed(1)} MB`
  return `${(byteLength / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function attachmentTypeLabel(item: Pick<AttachmentMetadata, 'name' | 'mimeType'>): string {
  const extension = extensionOf(item.name)
  if (extension) return extension.toUpperCase()
  if (item.mimeType === DEFAULT_ATTACHMENT_MIME_TYPE) return 'Archivo'
  const subtype = item.mimeType.split('/')[1]
  return subtype ? subtype.toUpperCase() : 'Archivo'
}
