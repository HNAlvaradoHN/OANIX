import {
  deleteEncryptedRecord,
  readEncryptedRecord,
  writeEncryptedRecord,
} from '../../storage/repositories/encryptedRecordRepository'
import {
  deleteEncryptedImage,
  loadEncryptedImagePreview,
  storeEncryptedImage,
} from '../images/imageService'
import { normalizeImageMimeType, type ImageMimeType } from './noteTypes'

const NOTE_AVATAR_RECORD_TYPE = 'note-avatar'
const NOTE_AVATAR_VERSION = 1 as const

export interface NoteAvatarRecord {
  version: typeof NOTE_AVATAR_VERSION
  noteId: string
  imageId: string
  mimeType: ImageMimeType
}

function isNoteAvatarRecord(value: unknown, noteId: string): value is NoteAvatarRecord {
  if (!value || typeof value !== 'object') return false
  const avatar = value as Partial<NoteAvatarRecord>
  return avatar.version === NOTE_AVATAR_VERSION
    && avatar.noteId === noteId
    && typeof avatar.imageId === 'string'
    && avatar.imageId.length > 0
    && normalizeImageMimeType(avatar.mimeType) !== null
}

function notifyAvatarChanged(noteId: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('oanix:note-avatar-changed', {
    detail: { noteId },
  }))
}

export async function readNoteAvatar(noteId: string): Promise<NoteAvatarRecord | null> {
  const value = await readEncryptedRecord<unknown>(NOTE_AVATAR_RECORD_TYPE, noteId)
  if (value === null) return null
  if (!isNoteAvatarRecord(value, noteId)) {
    throw new Error('El avatar cifrado de esta nota no es válido.')
  }
  return value
}

export async function loadNoteAvatarPreview(noteId: string): Promise<Blob | null> {
  const avatar = await readNoteAvatar(noteId)
  if (!avatar) return null
  return loadEncryptedImagePreview(avatar.imageId, avatar.mimeType)
}

export async function chooseNoteAvatar(noteId: string, file: File): Promise<NoteAvatarRecord> {
  const previous = await readNoteAvatar(noteId).catch(() => null)
  const stored = await storeEncryptedImage(file)
  const next: NoteAvatarRecord = {
    version: NOTE_AVATAR_VERSION,
    noteId,
    imageId: stored.imageId,
    mimeType: stored.mimeType,
  }

  try {
    await writeEncryptedRecord(NOTE_AVATAR_RECORD_TYPE, noteId, next)
  } catch (error) {
    await deleteEncryptedImage(stored.imageId).catch(() => undefined)
    throw error
  }

  notifyAvatarChanged(noteId)

  if (previous && previous.imageId !== next.imageId) {
    await deleteEncryptedImage(previous.imageId).catch(() => undefined)
  }

  return next
}

export async function deleteNoteAvatar(noteId: string): Promise<void> {
  const previous = await readNoteAvatar(noteId).catch(() => null)
  await deleteEncryptedRecord(NOTE_AVATAR_RECORD_TYPE, noteId)
  notifyAvatarChanged(noteId)
  if (previous) {
    await deleteEncryptedImage(previous.imageId).catch(() => undefined)
  }
}
