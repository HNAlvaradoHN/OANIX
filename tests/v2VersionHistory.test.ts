import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  NOTE_HISTORY_AUTOMATIC_WINDOW_MS,
  NOTE_HISTORY_MAX_SNAPSHOTS_PER_NOTE,
  shouldCaptureAutomaticSnapshot,
} from '../src/features/versionHistory/versionHistoryPolicy.ts'
import type { NoteHistorySnapshot } from '../src/features/versionHistory/versionHistoryTypes.ts'
import type { NoteRecord } from '../src/features/notes/noteTypes.ts'

function note(text: string, updatedAt = '2026-08-16T20:00:00.000Z'): NoteRecord {
  return {
    version: 1,
    id: 'note-1',
    title: 'Prueba',
    createdAt: '2026-08-16T19:00:00.000Z',
    updatedAt,
    content: {
      format: 'blocks-v1',
      blocks: [{ id: 'p-1', type: 'paragraph', runs: [{ text }] }],
    },
  }
}

function snapshot(value: NoteRecord, capturedAt: string, reason: 'automatic' | 'pre-restore' = 'automatic'): NoteHistorySnapshot {
  return {
    version: 1,
    id: 'snapshot-1',
    noteId: value.id,
    capturedAt,
    reason,
    note: value,
  }
}

test('automatic history keeps the first state inside a five minute coalescing window', () => {
  const original = note('original')
  const latest = snapshot(original, '2026-08-16T20:00:00.000Z')
  const changed = note('changed', '2026-08-16T20:01:00.000Z')

  assert.equal(NOTE_HISTORY_AUTOMATIC_WINDOW_MS, 5 * 60 * 1000)
  assert.equal(NOTE_HISTORY_MAX_SNAPSHOTS_PER_NOTE, 5)
  assert.equal(shouldCaptureAutomaticSnapshot(changed, latest, Date.parse('2026-08-16T20:04:59.999Z')), false)
  assert.equal(shouldCaptureAutomaticSnapshot(changed, latest, Date.parse('2026-08-16T20:05:00.000Z')), true)
})

test('history does not duplicate the exact same note state', () => {
  const current = note('same')
  const latest = snapshot(structuredClone(current), '2026-08-16T20:00:00.000Z')
  assert.equal(shouldCaptureAutomaticSnapshot(current, latest, Date.parse('2026-08-16T21:00:00.000Z')), false)
})

test('a pre-restore checkpoint does not suppress the next meaningful automatic baseline', () => {
  const previous = note('before restore')
  const latest = snapshot(previous, '2026-08-16T20:00:00.000Z', 'pre-restore')
  const current = note('restored version', '2026-08-16T20:00:10.000Z')
  assert.equal(shouldCaptureAutomaticSnapshot(current, latest, Date.parse('2026-08-16T20:00:11.000Z')), true)
})

test('history reuses encrypted_records and remains eligible for the existing non-binary sync', () => {
  const repository = readFileSync('src/storage/repositories/noteHistoryRepository.ts', 'utf8')
  const types = readFileSync('src/features/versionHistory/versionHistoryTypes.ts', 'utf8')
  const sync = readFileSync('src/features/sync/syncService.ts', 'utf8')

  assert.match(types, /NOTE_HISTORY_RECORD_TYPE = 'note-history'/)
  assert.match(repository, /writeEncryptedRecord\(NOTE_HISTORY_RECORD_TYPE/)
  assert.match(repository, /listEncryptedRecords<unknown>\(NOTE_HISTORY_RECORD_TYPE\)/)
  assert.doesNotMatch(repository, /indexedDB|localStorage|sessionStorage|caches\.open/)
  assert.match(sync, /LOCAL_ONLY_RECORD_TYPES/)
  assert.doesNotMatch(sync, /'note-history'/)
})

test('restoring a version creates a reversible checkpoint and refuses incomplete historical images', () => {
  const noteService = readFileSync('src/features/notes/noteService.ts', 'utf8')
  const historyService = readFileSync('src/features/versionHistory/versionHistoryService.ts', 'utf8')
  const blobRepository = readFileSync('src/storage/repositories/encryptedBlobRepository.ts', 'utf8')

  assert.match(noteService, /export async function restoreNoteVersion/)
  assert.match(noteService, /findMissingHistoricalImageIds/)
  assert.match(noteService, /'pre-restore'/)
  assert.match(historyService, /hasEncryptedImage/)
  assert.match(blobRepository, /getKey\(encryptedBlobKey/)
})

test('version history implementation remains preserved for later rebuild integration', () => {
  const app = readFileSync('src/app/App.tsx', 'utf8')
  const center = readFileSync('src/features/versionHistory/VersionHistoryCenter.tsx', 'utf8')
  const css = readFileSync('src/features/versionHistory/versionHistory.css', 'utf8')

  assert.match(app, /<RebuildApp onLock=\{lockVault\} \/>/)
  assert.doesNotMatch(app, /<VersionHistoryCenter/)
  assert.match(center, /Historial de versiones/)
  assert.match(center, /Restaurar esta versión/)
  assert.match(center, /NOTE_HISTORY_MAX_SNAPSHOTS_PER_NOTE/)
  assert.match(center, /loadNotes\(\)/)
  assert.match(css, /@media \(max-width: 760px\)/)
})
