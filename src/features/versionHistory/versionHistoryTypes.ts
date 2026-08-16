import { isNoteRecord, type NoteRecord } from '../notes/noteTypes'

export const NOTE_HISTORY_RECORD_TYPE = 'note-history'
export const NOTE_HISTORY_SCHEMA_VERSION = 1 as const

export type NoteHistoryReason = 'automatic' | 'pre-restore'

export interface NoteHistorySnapshot {
  version: typeof NOTE_HISTORY_SCHEMA_VERSION
  id: string
  noteId: string
  capturedAt: string
  reason: NoteHistoryReason
  note: NoteRecord
}

export function isNoteHistorySnapshot(value: unknown): value is NoteHistorySnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<NoteHistorySnapshot>

  return (
    snapshot.version === NOTE_HISTORY_SCHEMA_VERSION
    && typeof snapshot.id === 'string'
    && snapshot.id.length > 0
    && typeof snapshot.noteId === 'string'
    && snapshot.noteId.length > 0
    && typeof snapshot.capturedAt === 'string'
    && !Number.isNaN(Date.parse(snapshot.capturedAt))
    && (snapshot.reason === 'automatic' || snapshot.reason === 'pre-restore')
    && isNoteRecord(snapshot.note)
    && snapshot.note.id === snapshot.noteId
  )
}
