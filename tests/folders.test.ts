import assert from 'node:assert/strict'
import test from 'node:test'

import { isFolderRecord, normalizeFolderName, type FolderRecord } from '../src/features/folders/folderTypes.ts'
import { isNoteRecord, type NoteRecord } from '../src/features/notes/noteTypes.ts'

function folder(overrides: Partial<FolderRecord> = {}): FolderRecord {
  return { version: 1, id: 'folder-test-1', name: 'Trabajo', createdAt: '2026-08-15T00:00:00.000Z', updatedAt: '2026-08-15T00:00:00.000Z', ...overrides }
}

function note(folderId?: string | null): NoteRecord {
  return { version: 1, id: 'note-folder-test', title: 'Nota', createdAt: '2026-08-15T00:00:00.000Z', updatedAt: '2026-08-15T00:00:00.000Z', ...(folderId !== undefined ? { folderId } : {}), content: { format: 'blocks-v1', blocks: [] } }
}

test('folder names are normalized without losing internal words', () => {
  assert.equal(normalizeFolderName('  Trabajo   personal  '), 'Trabajo personal')
})

test('encrypted folder records have a strict local model', () => {
  assert.equal(isFolderRecord(folder()), true)
  assert.equal(isFolderRecord(folder({ name: '' })), false)
  assert.equal(isFolderRecord({ ...folder(), version: 2 }), false)
})

test('notes remain backwards compatible without folderId', () => {
  assert.equal(isNoteRecord(note()), true)
})

test('notes accept an encrypted folder relationship or explicit no-folder state', () => {
  assert.equal(isNoteRecord(note('folder-test-1')), true)
  assert.equal(isNoteRecord(note(null)), true)
  assert.equal(isNoteRecord({ ...note(), folderId: 123 }), false)
})
