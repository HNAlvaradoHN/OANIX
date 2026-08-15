import { deleteNoteRecord, listNotes, readNote, saveNote } from '../../storage/repositories/noteRepository'
import { createDailyEntryBlocks } from './dailyEntries'
import type { NoteRecord, StoredNoteBlock } from './noteTypes'

const DEFAULT_NOTE_TITLE = 'Nueva nota'
const UNTITLED_NOTE_TITLE = 'Sin título'
const mutationQueues = new Map<string, Promise<unknown>>()

function createNoteId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random generation is not available in this browser.')
  }

  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function enqueueNoteMutation(
  noteId: string,
  mutate: (note: NoteRecord) => NoteRecord,
): Promise<NoteRecord> {
  const previous = mutationQueues.get(noteId) ?? Promise.resolve()
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const existing = await readNote(noteId)

      if (!existing) {
        throw new Error('La nota ya no existe.')
      }

      const updated = mutate(existing)
      await saveNote(updated)
      return updated
    })

  mutationQueues.set(noteId, next)
  const cleanup = () => {
    if (mutationQueues.get(noteId) === next) {
      mutationQueues.delete(noteId)
    }
  }
  void next.then(cleanup, cleanup)

  return next
}

export async function loadNotes(): Promise<NoteRecord[]> {
  const notes = await listNotes()
  return notes.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function createEmptyNote(folderId: string | null = null, tagIds: string[] = []): Promise<NoteRecord> {
  const nowDate = new Date()
  const now = nowDate.toISOString()
  const note: NoteRecord = {
    version: 1,
    id: createNoteId(),
    title: DEFAULT_NOTE_TITLE,
    createdAt: now,
    updatedAt: now,
    folderId,
    tagIds: [...new Set(tagIds.filter((tagId) => tagId.length > 0))],
    content: {
      format: 'blocks-v1',
      blocks: createDailyEntryBlocks(nowDate),
    },
  }

  await saveNote(note)
  return note
}

export function deleteNote(noteId: string): Promise<NoteRecord> {
  const previous = mutationQueues.get(noteId) ?? Promise.resolve()
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const existing = await readNote(noteId)

      if (!existing) {
        throw new Error('La nota ya no existe.')
      }

      await deleteNoteRecord(noteId)
      return existing
    })

  mutationQueues.set(noteId, next)
  const cleanup = () => {
    if (mutationQueues.get(noteId) === next) {
      mutationQueues.delete(noteId)
    }
  }
  void next.then(cleanup, cleanup)

  return next
}

export function renameNote(noteId: string, title: string): Promise<NoteRecord> {
  const normalizedTitle = title.trim() || UNTITLED_NOTE_TITLE

  return enqueueNoteMutation(noteId, (existing) => ({
    ...existing,
    title: normalizedTitle,
    updatedAt: new Date().toISOString(),
  }))
}

export function replaceNoteContent(noteId: string, blocks: StoredNoteBlock[]): Promise<NoteRecord> {
  return enqueueNoteMutation(noteId, (existing) => ({
    ...existing,
    updatedAt: new Date().toISOString(),
    content: {
      format: 'blocks-v1',
      blocks,
    },
  }))
}

export function moveNoteToFolder(noteId: string, folderId: string | null): Promise<NoteRecord> {
  return enqueueNoteMutation(noteId, (existing) => ({
    ...existing,
    folderId,
  }))
}

export function setNoteTags(noteId: string, tagIds: string[]): Promise<NoteRecord> {
  const normalizedTagIds = [...new Set(tagIds.map((tagId) => tagId.trim()).filter(Boolean))]
  return enqueueNoteMutation(noteId, (existing) => ({
    ...existing,
    tagIds: normalizedTagIds,
    updatedAt: new Date().toISOString(),
  }))
}
