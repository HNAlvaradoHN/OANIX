import { listNotes, readNote, saveNote } from '../../storage/repositories/noteRepository'
import type { NoteBlock, NoteRecord } from './noteTypes'

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
  void next.finally(() => {
    if (mutationQueues.get(noteId) === next) {
      mutationQueues.delete(noteId)
    }
  })

  return next
}

export async function loadNotes(): Promise<NoteRecord[]> {
  const notes = await listNotes()
  return notes.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function createEmptyNote(): Promise<NoteRecord> {
  const now = new Date().toISOString()
  const note: NoteRecord = {
    version: 1,
    id: createNoteId(),
    title: DEFAULT_NOTE_TITLE,
    createdAt: now,
    updatedAt: now,
    content: {
      format: 'blocks-v1',
      blocks: [],
    },
  }

  await saveNote(note)
  return note
}

export function renameNote(noteId: string, title: string): Promise<NoteRecord> {
  const normalizedTitle = title.trim() || UNTITLED_NOTE_TITLE

  return enqueueNoteMutation(noteId, (existing) => ({
    ...existing,
    title: normalizedTitle,
    updatedAt: new Date().toISOString(),
  }))
}

export function replaceNoteContent(noteId: string, blocks: NoteBlock[]): Promise<NoteRecord> {
  return enqueueNoteMutation(noteId, (existing) => ({
    ...existing,
    updatedAt: new Date().toISOString(),
    content: {
      format: 'blocks-v1',
      blocks,
    },
  }))
}
