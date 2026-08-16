import {
  deleteNoteHistorySnapshot,
  listNoteHistorySnapshots,
  saveNoteHistorySnapshot,
} from '../../storage/repositories/noteHistoryRepository'
import { hasEncryptedImage } from '../images/imageService'
import type { NoteRecord } from '../notes/noteTypes'
import {
  NOTE_HISTORY_AUTOMATIC_WINDOW_MS,
  NOTE_HISTORY_MAX_SNAPSHOTS_PER_NOTE,
  shouldCaptureAutomaticSnapshot,
} from './versionHistoryPolicy'
import {
  NOTE_HISTORY_SCHEMA_VERSION,
  type NoteHistoryReason,
  type NoteHistorySnapshot,
} from './versionHistoryTypes'

export {
  NOTE_HISTORY_AUTOMATIC_WINDOW_MS,
  NOTE_HISTORY_MAX_SNAPSHOTS_PER_NOTE,
  shouldCaptureAutomaticSnapshot,
} from './versionHistoryPolicy'

function createSnapshotId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random generation is not available for note history.')
  }

  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(24)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function sameNoteState(left: NoteRecord, right: NoteRecord): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function imageIdsInNote(note: NoteRecord): string[] {
  return [...new Set(note.content.blocks.flatMap((block) => block.type === 'image' ? [block.imageId] : []))]
}

export function sortNoteHistoryNewestFirst(snapshots: NoteHistorySnapshot[]): NoteHistorySnapshot[] {
  return [...snapshots].sort((left, right) => {
    const time = right.capturedAt.localeCompare(left.capturedAt)
    return time || right.id.localeCompare(left.id)
  })
}

export async function listNoteVersionHistory(noteId: string): Promise<NoteHistorySnapshot[]> {
  const all = await listNoteHistorySnapshots()
  return sortNoteHistoryNewestFirst(all.filter((snapshot) => snapshot.noteId === noteId))
}

async function pruneNoteHistory(noteId: string): Promise<void> {
  const snapshots = await listNoteVersionHistory(noteId)
  const overflow = snapshots.slice(NOTE_HISTORY_MAX_SNAPSHOTS_PER_NOTE)
  if (overflow.length === 0) return
  await Promise.all(overflow.map((snapshot) => deleteNoteHistorySnapshot(snapshot.id)))
}

export async function captureNoteVersion(
  note: NoteRecord,
  reason: NoteHistoryReason = 'automatic',
  now = new Date(),
): Promise<NoteHistorySnapshot | null> {
  const history = await listNoteVersionHistory(note.id)
  const latest = history[0] ?? null

  if (latest && sameNoteState(latest.note, note)) return null
  if (reason === 'automatic' && !shouldCaptureAutomaticSnapshot(note, latest, now.getTime())) return null

  const snapshot: NoteHistorySnapshot = {
    version: NOTE_HISTORY_SCHEMA_VERSION,
    id: createSnapshotId(),
    noteId: note.id,
    capturedAt: now.toISOString(),
    reason,
    note: structuredClone(note),
  }

  await saveNoteHistorySnapshot(snapshot)
  await pruneNoteHistory(note.id)
  return snapshot
}

export async function capturePreRestoreVersion(note: NoteRecord): Promise<NoteHistorySnapshot | null> {
  return captureNoteVersion(note, 'pre-restore')
}

export async function findMissingHistoricalImageIds(snapshot: NoteHistorySnapshot): Promise<string[]> {
  const imageIds = imageIdsInNote(snapshot.note)
  if (imageIds.length === 0) return []

  const availability = await Promise.all(imageIds.map(async (imageId) => ({
    imageId,
    exists: await hasEncryptedImage(imageId),
  })))

  return availability.filter((item) => !item.exists).map((item) => item.imageId)
}

export async function deleteNoteVersionHistory(noteId: string): Promise<void> {
  const snapshots = await listNoteVersionHistory(noteId)
  await Promise.all(snapshots.map((snapshot) => deleteNoteHistorySnapshot(snapshot.id)))
}
