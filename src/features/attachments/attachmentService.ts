import {
  deleteEncryptedBlob,
  readEncryptedBlob,
  writeEncryptedBlob,
} from '../../storage/repositories/encryptedBlobRepository'
import {
  deleteEncryptedRecord,
  readEncryptedRecord,
  writeEncryptedRecord,
} from '../../storage/repositories/encryptedRecordRepository'
import {
  isAttachmentIndex,
  isRemoteLargeAttachment,
  MAX_LOCAL_ATTACHMENT_BYTES,
  validateAttachmentCandidate,
  type AttachmentIndex,
  type AttachmentMetadata,
} from './attachmentTypes'
import {
  deleteLargeAttachmentFromDrive,
  uploadLargeAttachmentToDrive,
} from './largeAttachmentDriveService'

export const ATTACHMENT_BLOB_RECORD_TYPE = 'attachment'
export const ATTACHMENT_INDEX_RECORD_TYPE = 'note-attachments'

function createAttachmentId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('OANIX no dispone de generación aleatoria segura para crear el adjunto.')
  }

  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(20)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function requireNoteId(noteId: string): string {
  const normalized = noteId.trim()
  if (!normalized) throw new Error('No se pudo identificar la nota del adjunto.')
  return normalized
}

async function readAttachmentIndex(noteId: string): Promise<AttachmentIndex> {
  const normalizedNoteId = requireNoteId(noteId)
  const stored = await readEncryptedRecord<unknown>(ATTACHMENT_INDEX_RECORD_TYPE, normalizedNoteId)
  if (stored === null) return { version: 1, noteId: normalizedNoteId, items: [] }
  if (!isAttachmentIndex(stored, normalizedNoteId)) {
    throw new Error('La lista cifrada de adjuntos de esta nota está dañada o no es compatible.')
  }
  return stored
}

async function writeAttachmentIndex(index: AttachmentIndex): Promise<void> {
  if (index.items.length === 0) {
    await deleteEncryptedRecord(ATTACHMENT_INDEX_RECORD_TYPE, index.noteId)
    return
  }
  await writeEncryptedRecord(ATTACHMENT_INDEX_RECORD_TYPE, index.noteId, index)
}

export async function loadEncryptedAttachments(noteId: string): Promise<AttachmentMetadata[]> {
  const index = await readAttachmentIndex(noteId)
  return [...index.items].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

export async function storeEncryptedAttachment(
  noteId: string,
  file: File,
): Promise<AttachmentMetadata> {
  const normalizedNoteId = requireNoteId(noteId)
  const validated = validateAttachmentCandidate(file)
  if (validated.byteLength > MAX_LOCAL_ATTACHMENT_BYTES) {
    throw new Error('Este archivo necesita almacenamiento por fragmentos. La integración con la tarjeta de adjuntos todavía no está activada.')
  }

  const attachmentId = createAttachmentId()
  const metadata: AttachmentMetadata = {
    attachmentId,
    name: validated.name,
    mimeType: validated.mimeType,
    byteLength: validated.byteLength,
    createdAt: new Date().toISOString(),
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  try {
    await writeEncryptedBlob(ATTACHMENT_BLOB_RECORD_TYPE, attachmentId, bytes)
  } finally {
    bytes.fill(0)
  }

  try {
    const index = await readAttachmentIndex(normalizedNoteId)
    await writeAttachmentIndex({ ...index, items: [...index.items, metadata] })
  } catch (error) {
    try {
      await deleteEncryptedBlob(ATTACHMENT_BLOB_RECORD_TYPE, attachmentId)
    } catch {
      // The original indexing failure remains authoritative; a later hygiene pass can remove an orphan.
    }
    throw error
  }

  return metadata
}

export async function storeRemoteLargeAttachment(
  noteId: string,
  file: File,
): Promise<AttachmentMetadata> {
  const normalizedNoteId = requireNoteId(noteId)
  const validated = validateAttachmentCandidate(file)
  if (validated.byteLength <= MAX_LOCAL_ATTACHMENT_BYTES) {
    throw new Error('Este archivo cabe en el almacenamiento local normal de adjuntos.')
  }

  const storage = await uploadLargeAttachmentToDrive(normalizedNoteId, file)
  const metadata: AttachmentMetadata = {
    attachmentId: createAttachmentId(),
    name: validated.name,
    mimeType: validated.mimeType,
    byteLength: validated.byteLength,
    createdAt: new Date().toISOString(),
    storage,
  }

  try {
    const index = await readAttachmentIndex(normalizedNoteId)
    await writeAttachmentIndex({ ...index, items: [...index.items, metadata] })
  } catch (error) {
    try {
      await deleteLargeAttachmentFromDrive(storage)
    } catch {
      // Preserve the indexing failure; remote cleanup can be retried if the provider failed too.
    }
    throw error
  }

  return metadata
}

export async function loadEncryptedAttachmentFile(
  metadata: AttachmentMetadata,
): Promise<File | null> {
  if (isRemoteLargeAttachment(metadata)) return null
  const bytes = await readEncryptedBlob(ATTACHMENT_BLOB_RECORD_TYPE, metadata.attachmentId)
  if (!bytes) return null

  try {
    return new File([Uint8Array.from(bytes)], metadata.name, {
      type: metadata.mimeType,
      lastModified: Date.parse(metadata.createdAt) || Date.now(),
    })
  } finally {
    bytes.fill(0)
  }
}

export async function removeEncryptedAttachment(
  noteId: string,
  attachmentId: string,
): Promise<void> {
  const index = await readAttachmentIndex(noteId)
  const existing = index.items.find((item) => item.attachmentId === attachmentId)
  if (!existing) return

  if (isRemoteLargeAttachment(existing) && existing.storage) {
    await deleteLargeAttachmentFromDrive(existing.storage)
    await writeAttachmentIndex({
      ...index,
      items: index.items.filter((item) => item.attachmentId !== attachmentId),
    })
    return
  }

  const nextIndex: AttachmentIndex = {
    ...index,
    items: index.items.filter((item) => item.attachmentId !== attachmentId),
  }

  await writeAttachmentIndex(nextIndex)
  try {
    await deleteEncryptedBlob(ATTACHMENT_BLOB_RECORD_TYPE, attachmentId)
  } catch (error) {
    try {
      await writeAttachmentIndex(index)
    } catch {
      throw new Error('No se pudo completar ni revertir la eliminación del adjunto cifrado.')
    }
    throw error
  }
}

export async function assertAttachmentsAllowNoteDeletion(noteId: string): Promise<void> {
  const index = await readAttachmentIndex(noteId)
  if (index.items.some(isRemoteLargeAttachment)) {
    throw new Error('Quita primero los archivos grandes remotos de esta nota para evitar dejar datos huérfanos en la nube.')
  }
}

export async function deleteAllEncryptedAttachmentsForNote(noteId: string): Promise<void> {
  const index = await readAttachmentIndex(noteId)
  if (index.items.length === 0) return
  if (index.items.some(isRemoteLargeAttachment)) {
    throw new Error('No se eliminará una nota con archivos grandes remotos sin quitarlos primero.')
  }

  const results = await Promise.allSettled(
    index.items.map((item) => deleteEncryptedBlob(ATTACHMENT_BLOB_RECORD_TYPE, item.attachmentId)),
  )
  if (results.some((result) => result.status === 'rejected')) {
    throw new Error('No se pudieron limpiar todos los adjuntos cifrados de la nota eliminada.')
  }

  await deleteEncryptedRecord(ATTACHMENT_INDEX_RECORD_TYPE, index.noteId)
}
