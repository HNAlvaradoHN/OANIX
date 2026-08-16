import assert from 'node:assert/strict'
import test from 'node:test'

import {
  filterByLocalSearch,
  findLocalSearchMatches,
  localSearchTextMatches,
  localSearchTokens,
  normalizeLocalSearchText,
  searchItemsByLocalFields,
  type LocalSearchField,
} from '../src/features/search/localSearch.ts'
import { noteBlocksToPlainText, type NoteRecord } from '../src/features/notes/noteTypes.ts'

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

function searchableText(item: NoteRecord): string {
  return `${item.title}\n${noteBlocksToPlainText(item.content.blocks)}`
}

test('normalizes case, accents and extra whitespace locally', () => {
  assert.equal(normalizeLocalSearchText('  ReUNIÓN   TÉCNICA  '), 'reunion tecnica')
  assert.deepEqual(localSearchTokens(' José   sensor '), ['jose', 'sensor'])
})

test('searches title and all plain-text block content', () => {
  const searchable = searchableText(note())

  assert.equal(localSearchTextMatches(searchable, 'reunion'), true)
  assert.equal(localSearchTextMatches(searchable, 'tablero'), true)
  assert.equal(localSearchTextMatches(searchable, 'npm build'), true)
  assert.equal(localSearchTextMatches(searchable, 'sensor'), true)
  assert.equal(localSearchTextMatches(searchable, 'jose proveedor'), true)
  assert.equal(localSearchTextMatches(searchable, 'seguimiento sabado'), true)
  assert.equal(localSearchTextMatches(searchable, 'contenido inexistente'), false)
})

test('combines multiple query words regardless of their position', () => {
  const searchable = searchableText(note())
  assert.equal(localSearchTextMatches(searchable, 'proveedor jose'), true)
  assert.equal(localSearchTextMatches(searchable, 'sensor reunion'), true)
})

test('filters decrypted notes without changing their order', () => {
  const first = note({ id: 'first', title: 'Alpha' })
  const second = note({ id: 'second', title: 'Beta', content: { format: 'blocks-v1', blocks: [{ id: 'p2', type: 'paragraph', runs: [{ text: 'Solo esta contiene galaxia' }] }] } })
  const third = note({ id: 'third', title: 'Gamma' })

  assert.deepEqual(filterByLocalSearch([first, second, third], 'galaxia', searchableText).map((item) => item.id), ['second'])
  assert.deepEqual(filterByLocalSearch([first, second, third], '', searchableText).map((item) => item.id), ['first', 'second', 'third'])
})

test('returns labeled locations and occurrence counts for a match', () => {
  const fields: LocalSearchField[] = [
    { key: 'title', label: 'Título', text: 'Sensores de producción' },
    { key: 'paragraph', label: 'Texto', text: 'Revisar sensores y limpiar sensores del pasillo norte.' },
    { key: 'code', label: 'Código', text: 'const sensor = true' },
  ]

  const matches = findLocalSearchMatches(fields, 'sensores')

  assert.deepEqual(matches.map((match) => match.label), ['Título', 'Texto'])
  assert.equal(matches[0]?.occurrences, 1)
  assert.equal(matches[1]?.occurrences, 2)
  assert.match(matches[1]?.snippet ?? '', /sensores/i)
})

test('global item search is independent from external folder state', () => {
  const items = [
    { id: 'folder-3-note', folder: '3', title: 'Otra cosa', text: 'Nada aquí' },
    { id: 'folder-1-note', folder: '1', title: 'Mantenimiento', text: 'Revisar sensores del área' },
    { id: 'folder-2-note', folder: '2', title: 'Compras', text: 'Comprar sensores nuevos' },
  ]

  const results = searchItemsByLocalFields(items, 'sensores', (item) => [
    { key: `${item.id}:title`, label: 'Título', text: item.title },
    { key: `${item.id}:text`, label: 'Texto', text: item.text },
  ])

  assert.deepEqual(results.map((result) => result.item.id), ['folder-1-note', 'folder-2-note'])
  assert.equal(results.every((result) => result.matches.length > 0), true)
})

test('multi-word global search can report terms found in different locations of one item', () => {
  const fields: LocalSearchField[] = [
    { key: 'title', label: 'Título', text: 'Reunión de mantenimiento' },
    { key: 'checklist', label: 'Checklist', text: 'Revisar sensores' },
  ]

  const matches = findLocalSearchMatches(fields, 'reunion sensores')
  assert.deepEqual(matches.map((match) => match.label), ['Título', 'Checklist'])
})
