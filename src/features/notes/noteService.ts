import { listNotes, readNote, saveNote } from '../../storage/repositories/noteRepository'
import type { NoteRecord } from './noteTypes'

const DEFAULT_NOTE_TITLE = 'Nueva nota'
const UNTITLED_NOTE_TITLE = 'Sin título'

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

export async function renameNote(noteId: string, title: string): Promise<NoteRecord> {
  const existing = await readNote(noteId)

  if (!existing) {
    throw new Error('La nota ya no existe.')
  }

  const normalizedTitle = title.trim() || UNTITLED_NOTE_TITLE
  const updated: NoteRecord = {
    ...existing,
    title: normalizedTitle,
    updatedAt: new Date().toISOString(),
  }

  await saveNote(updated)
  return updated
}
