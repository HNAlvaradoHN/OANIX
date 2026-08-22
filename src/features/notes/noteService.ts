import { deleteNoteRecord, listNotes, readNote, saveNote } from '../../storage/repositories/noteRepository'
import { assertAttachmentsAllowNoteDeletion } from '../attachments/attachmentService'
import {
  captureNoteVersion,
  deleteNoteVersionHistory,
  findMissingHistoricalImageIds,
} from '../versionHistory/versionHistoryService'
import type { NoteHistoryReason, NoteHistorySnapshot } from '../versionHistory/versionHistoryTypes'
import { createDailyEntryBlocks } from './dailyEntries'
import { deleteNoteAvatar } from './noteAvatarService'
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

function sameNoteState(left: NoteRecord, right: NoteRecord): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function reportHistoryWarning(noteId: string, error: unknown) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('oanix:history-warning', {
    detail: {
      noteId,
      message: error instanceof Error ? error.message : 'No se pudo guardar un punto del historial.',
    },
  }))
}

function enqueueNoteMutation(
  noteId: string,
  mutate: (note: NoteRecord) => NoteRecord,
  historyReason: NoteHistoryReason = 'automatic',
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
      if (sameNoteState(existing, updated)) return existing

      let historyError: unknown = null
      try {
        await captureNoteVersion(existing, historyReason)
      } catch (error) {
        historyError = error
      }

      await saveNote(updated)
      if (historyError) reportHistoryWarning(noteId, historyError)
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

async function createNewNoteRecord(
  title: string,
  blocks: StoredNoteBlock[],
  folderId: string | null,
  tagIds: string[],
  nowDate = new Date(),
): Promise<NoteRecord> {
  const now = nowDate.toISOString()
  const existingNotes = await listNotes()
  const canContinueManualOrder = existingNotes.length === 0 || existingNotes.every((note) =>
    Number.isSafeInteger(note.manualOrder) && (note.manualOrder ?? -1) >= 0,
  )
  const highestManualOrder = canContinueManualOrder
    ? existingNotes.reduce((highest, note) => Math.max(highest, note.manualOrder ?? 0), 0
    )
    : 0
  const nextManualOrder = canContinueManualOrder && highestManualOrder < Number.MAX_SAFE_INTEGER
    ? highestManualOrder + 1
    : undefined

  const note: NoteRecord = {
    version: 1,
    id: createNoteId(),
    title: title.trim() || UNTITLED_NOTE_TITLE,
    createdAt: now,
    updatedAt: now,
    folderId,
    tagIds: [...new Set(tagIds.filter((tagId) => tagId.length > 0))],
    ...(nextManualOrder === undefined ? {} : { manualOrder: nextManualOrder }),
    content: {
      format: 'blocks-v1',
      blocks,
    },
  }

  await saveNote(note)
  return note
}

export async function loadNotes(): Promise<NoteRecord[]> {
  const notes = await listNotes()
  return notes.sort(compareNotesForList)
}

export function createEmptyNote(folderId: string | null = null, tagIds: string[] = []): Promise<NoteRecord> {
  const nowDate = new Date()
  return createNewNoteRecord(
    DEFAULT_NOTE_TITLE,
    createDailyEntryBlocks(nowDate),
    folderId,
    tagIds,
    nowDate,
  )
}

export function createNoteWithContent(
  title: string,
  blocks: StoredNoteBlock[],
  folderId: string | null = null,
  tagIds: string[] = [],
): Promise<NoteRecord> {
  return createNewNoteRecord(title, blocks, folderId, tagIds)
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

      await assertAttachmentsAllowNoteDeletion(noteId)
      await deleteNoteRecord(noteId)
      try {
        await deleteNoteVersionHistory(noteId)
      } catch (error) {
        reportHistoryWarning(noteId, error)
      }
      try {
        await deleteNoteAvatar(noteId)
      } catch {
        // Avatar cleanup is best-effort after the authoritative note record is gone.
      }
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

export async function restoreNoteVersion(snapshot: NoteHistorySnapshot): Promise<NoteRecord> {
  const missingImageIds = await findMissingHistoricalImageIds(snapshot)
  if (missingImageIds.length > 0) {
    throw new Error(
      `Esta versión no se puede restaurar completa porque ${missingImageIds.length} imagen${missingImageIds.length === 1 ? '' : 'es'} histórica${missingImageIds.length === 1 ? '' : 's'} ya no está${missingImageIds.length === 1 ? '' : 'n'} disponible${missingImageIds.length === 1 ? '' : 's'}.`,
    )
  }

  return enqueueNoteMutation(
    snapshot.noteId,
    (existing) => ({
      ...structuredClone(snapshot.note),
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    }),
    'pre-restore',
  )
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
