import { deleteNoteRecord, listNotes, readNote, saveNote } from '../../storage/repositories/noteRepository'
import { createDailyEntryBlocks } from './dailyEntries'
import { compareNotesForList, type NoteRecord, type StoredNoteBlock } from './noteTypes'

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
  return notes.sort(compareNotesForList)
}

export async function createEmptyNote(folderId: string | null = null, tagIds: string[] = []): Promise<NoteRecord> {
  const nowDate = new Date()
  const now = nowDate.toISOString()
  const existingNotes = await listNotes()
  const canContinueManualOrder = existingNotes.length === 0 || existingNotes.every((note) =>
    Number.isSafeInteger(note.manualOrder) && (note.manualOrder ?? -1) >= 0,
  )
  const highestManualOrder = canContinueManualOrder
    ? existingNotes.reduce((highest, note) => Math.max(highest, note.manualOrder ?? 0), 0)
    : 0
  const nextManualOrder = canContinueManualOrder && highestManualOrder < Number.MAX_SAFE_INTEGER
    ? highestManualOrder + 1
    : undefined

  const note: NoteRecord = {
    version: 1,
    id: createNoteId(),
    title: DEFAULT_NOTE_TITLE,
    createdAt: now,
    updatedAt: now,
    folderId,
    tagIds: [...new Set(tagIds.filter((tagId) => tagId.length > 0))],
    ...(nextManualOrder === undefined ? {} : { manualOrder: nextManualOrder }),
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

export function setNotePinned(noteId: string, pinned: boolean): Promise<NoteRecord> {
  return enqueueNoteMutation(noteId, (existing) => ({
    ...existing,
    pinned,
  }))
}

export async function persistNoteOrder(orderedNoteIds: string[]): Promise<NoteRecord[]> {
  const uniqueIds = [...new Set(orderedNoteIds)]
  if (uniqueIds.length !== orderedNoteIds.length) {
    throw new Error('El orden de notas contiene identificadores duplicados.')
  }
  if (uniqueIds.length === 0) return []

  const records = await Promise.all(uniqueIds.map((noteId) => readNote(noteId)))
  if (records.some((note) => !note)) {
    throw new Error('No se pudo ordenar porque una nota ya no existe.')
  }

  const existingRecords = records as NoteRecord[]
  const recordById = new Map(existingRecords.map((note) => [note.id, note]))
  const allHaveManualOrder = existingRecords.every((note) =>
    Number.isSafeInteger(note.manualOrder) && (note.manualOrder ?? -1) >= 0,
  )

  const targetOrders = allHaveManualOrder
    ? [...existingRecords]
        .sort(compareNotesForList)
        .map((note) => note.manualOrder ?? 0)
    : orderedNoteIds.map((_, index) => orderedNoteIds.length - index)

  const updatedById = new Map<string, NoteRecord>()
  await Promise.all(orderedNoteIds.map(async (noteId, index) => {
    const existing = recordById.get(noteId)
    if (!existing) return
    const manualOrder = targetOrders[index]

    if (existing.manualOrder === manualOrder) {
      updatedById.set(noteId, existing)
      return
    }

    const updated = await enqueueNoteMutation(noteId, (current) => ({
      ...current,
      manualOrder,
    }))
    updatedById.set(noteId, updated)
  }))

  return orderedNoteIds.map((noteId) => updatedById.get(noteId) ?? recordById.get(noteId)!)
}
