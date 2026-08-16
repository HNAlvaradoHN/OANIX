import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { isNoteRecord, noteBlocksToPlainText } from '../src/features/notes/noteTypes.ts'

test('one V1 note can contain every supported block without invalidating the record', () => {
  const note = {
    version: 1,
    id: 'note-v1-regression',
    title: 'Validación completa V1',
    createdAt: '2026-08-16T00:00:00.000Z',
    updatedAt: '2026-08-16T01:00:00.000Z',
    folderId: 'folder-work',
    tagIds: ['tag-important', 'tag-local'],
    content: {
      format: 'blocks-v1',
      blocks: [
        {
          id: 'day-1',
          type: 'dailyEntry',
          date: '2026-08-16',
          title: 'Entrada del día',
        },
        {
          id: 'paragraph-1',
          type: 'paragraph',
          runs: [
            { text: 'Texto enriquecido ' },
            { text: 'seguro', bold: true },
            { text: ' con enlace', href: 'https://example.com' },
          ],
        },
        {
          id: 'heading-1',
          type: 'heading',
          level: 2,
          runs: [{ text: 'Encabezado V1' }],
        },
        {
          id: 'quote-1',
          type: 'quote',
          runs: [{ text: 'Cita privada' }],
        },
        {
          id: 'bullets-1',
          type: 'bulletList',
          items: [[{ text: 'Elemento con viñeta' }]],
        },
        {
          id: 'ordered-1',
          type: 'orderedList',
          items: [[{ text: 'Elemento ordenado' }]],
        },
        {
          id: 'checklist-1',
          type: 'checklist',
          items: [
            { text: 'Tarea pendiente', checked: false },
            { text: 'Tarea terminada', checked: true },
          ],
        },
        {
          id: 'contact-1',
          type: 'contact',
          name: 'Contacto privado',
          phone: '+504 9999-9999',
          email: 'privado@example.com',
          organization: 'OANIX',
          notes: 'Dato de contacto cifrado',
        },
        {
          id: 'divider-1',
          type: 'divider',
        },
        {
          id: 'code-1',
          type: 'code',
          language: 'typescript',
          text: 'const offline = true',
        },
        {
          id: 'image-1',
          type: 'image',
          imageId: 'encrypted-image-1',
          mimeType: 'image/jpeg',
          name: 'recibo.jpg',
          byteLength: 2048,
          alt: 'Recibo privado',
          widthPercent: 22,
          alignment: 'right',
          locked: true,
          showName: false,
        },
      ],
    },
  }

  assert.equal(isNoteRecord(note), true)

  const searchableText = noteBlocksToPlainText(note.content.blocks)
  for (const expected of [
    'Entrada del día',
    'Texto enriquecido seguro con enlace',
    'Encabezado V1',
    'Cita privada',
    'Elemento con viñeta',
    'Elemento ordenado',
    'Tarea pendiente',
    'Tarea terminada',
    'Contacto privado',
    'const offline = true',
    'Recibo privado',
  ]) {
    assert.match(searchableText, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('V1 keeps local storage compact instead of creating a store per feature', () => {
  const databaseSource = readFileSync('src/storage/local/database.ts', 'utf8')
  const createStoreCalls = databaseSource.match(/\.createObjectStore\(/g) ?? []

  assert.equal(createStoreCalls.length, 2)
  assert.match(databaseSource, /VAULT_METADATA_STORE = 'vault_metadata'/)
  assert.match(databaseSource, /ENCRYPTED_RECORDS_STORE = 'encrypted_records'/)
})

test('PWA updates stay prompt-based and reuse the existing service worker cache', () => {
  const mainSource = readFileSync('src/main.tsx', 'utf8')
  const appSource = readFileSync('src/app/App.tsx', 'utf8')
  const viteSource = readFileSync('vite.config.ts', 'utf8')

  assert.match(mainSource, /onNeedRefresh/)
  assert.match(mainSource, /oanix:update-available/)
  assert.match(mainSource, /registration\.update\(\)/)
  assert.match(mainSource, /updateSW\(true\)/)
  assert.match(appSource, /Nueva versión disponible/)
  assert.match(appSource, /prepareVisibleWorkspaceForUpdate/)
  assert.match(appSource, /document\.activeElement/)
  assert.match(appSource, /\.save-status/)
  assert.match(viteSource, /registerType: 'prompt'/)
  assert.match(viteSource, /cleanupOutdatedCaches: true/)
  assert.doesNotMatch(mainSource, /caches\.open|localStorage|indexedDB/)
})
