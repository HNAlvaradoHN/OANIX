import assert from 'node:assert/strict'
import test from 'node:test'

import {
  filterNotesByLocalSearch,
  localSearchTokens,
  normalizeLocalSearchText,
  noteMatchesLocalSearch,
} from '../src/features/search/localSearch.ts'
import type { NoteRecord } from '../src/features/notes/noteTypes.ts'

function note(overrides: Partial<NoteRecord> = {}): NoteRecord {
  return {
    version: 1,
    id: 'note-1',
    title: 'Reunión técnica',
    createdAt: '2026-08-15T12:00:00.000Z',
    updatedAt: '2026-08-15T12:00:00.000Z',
    content: {
      format: 'blocks-v1',
      blocks: [
        { id: 'p1', type: 'paragraph', runs: [{ text: 'Pendiente revisar el tablero principal' }] },
        { id: 'c1', type: 'code', language: 'bash', text: 'npm run build' },
        { id: 'k1', type: 'checklist', items: [{ text: 'Comprar sensor', checked: false }] },
        {
          id: 'contact-1',
          type: 'contact',
          name: 'José Martínez',
          phone: '+504 9999-1234',
          email: 'jose@example.com',
          organization: 'OANIX Labs',
          notes: 'Proveedor local',
        },
        { id: 'd1', type: 'dailyEntry', date: '2026-08-15', title: 'Seguimiento sábado' },
      ],
    },
    ...overrides,
  }
}

test('normalizes case, accents and extra whitespace locally', () => {
  assert.equal(normalizeLocalSearchText('  ReUNIÓN   TÉCNICA  '), 'reunion tecnica')
  assert.deepEqual(localSearchTokens(' José   sensor '), ['jose', 'sensor'])
})

test('searches title and all plain-text block content', () => {
  const sample = note()

  assert.equal(noteMatchesLocalSearch(sample, 'reunion'), true)
  assert.equal(noteMatchesLocalSearch(sample, 'tablero'), true)
  assert.equal(noteMatchesLocalSearch(sample, 'npm build'), true)
  assert.equal(noteMatchesLocalSearch(sample, 'sensor'), true)
  assert.equal(noteMatchesLocalSearch(sample, 'jose proveedor'), true)
  assert.equal(noteMatchesLocalSearch(sample, 'seguimiento sabado'), true)
  assert.equal(noteMatchesLocalSearch(sample, 'contenido inexistente'), false)
})

test('combines multiple query words regardless of their position', () => {
  const sample = note()
  assert.equal(noteMatchesLocalSearch(sample, 'proveedor jose'), true)
  assert.equal(noteMatchesLocalSearch(sample, 'sensor reunion'), true)
})

test('filters decrypted notes without changing their order', () => {
  const first = note({ id: 'first', title: 'Alpha' })
  const second = note({ id: 'second', title: 'Beta', content: { format: 'blocks-v1', blocks: [{ id: 'p2', type: 'paragraph', runs: [{ text: 'Solo esta contiene galaxia' }] }] } })
  const third = note({ id: 'third', title: 'Gamma' })

  assert.deepEqual(filterNotesByLocalSearch([first, second, third], 'galaxia').map((item) => item.id), ['second'])
  assert.deepEqual(filterNotesByLocalSearch([first, second, third], '').map((item) => item.id), ['first', 'second', 'third'])
})
