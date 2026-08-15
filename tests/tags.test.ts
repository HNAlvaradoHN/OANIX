import assert from 'node:assert/strict'
import test from 'node:test'
import { isTagRecord, normalizeTagName } from '../src/features/tags/tagTypes.ts'
import { isNoteRecord } from '../src/features/notes/noteTypes.ts'

const baseNote = {
  version: 1 as const,
  id: 'note-1',
  title: 'Nota',
  createdAt: '2026-08-15T12:00:00.000Z',
  updatedAt: '2026-08-15T12:00:00.000Z',
  content: {
    format: 'blocks-v1' as const,
    blocks: [],
  },
}

test('tag names are normalized without losing words', () => {
  assert.equal(normalizeTagName('  Trabajo   urgente  '), 'Trabajo urgente')
})

test('encrypted tags use a strict local record model', () => {
  assert.equal(isTagRecord({
    version: 1,
    id: 'tag-1',
    name: 'Trabajo',
    createdAt: '2026-08-15T12:00:00.000Z',
    updatedAt: '2026-08-15T12:00:00.000Z',
  }), true)
  assert.equal(isTagRecord({ version: 1, id: 'tag-1', name: ' ', createdAt: '', updatedAt: '' }), false)
})

test('older notes remain valid without tagIds', () => {
  assert.equal(isNoteRecord(baseNote), true)
})

test('notes accept unique encrypted tag relationships', () => {
  assert.equal(isNoteRecord({ ...baseNote, tagIds: ['tag-1', 'tag-2'] }), true)
  assert.equal(isNoteRecord({ ...baseNote, tagIds: ['tag-1', 'tag-1'] }), false)
  assert.equal(isNoteRecord({ ...baseNote, tagIds: [''] }), false)
})
