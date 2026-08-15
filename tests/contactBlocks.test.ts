import assert from 'node:assert/strict'
import test from 'node:test'

import { isNoteRecord, noteBlocksToPlainText, type NoteRecord } from '../src/features/notes/noteTypes.ts'

function contactNote(): NoteRecord {
  return {
    version: 1,
    id: 'note-contact-test',
    title: 'Contacto',
    createdAt: '2026-08-15T00:00:00.000Z',
    updatedAt: '2026-08-15T00:00:00.000Z',
    content: {
      format: 'blocks-v1',
      blocks: [{
        id: 'contact-block-1',
        type: 'contact',
        name: 'Ana López',
        phone: '+504 9999-0000',
        email: 'ana@example.com',
        organization: 'OANIX',
        notes: 'Contacto de prueba',
      }],
    },
  }
}

test('private contact blocks survive note validation', () => {
  assert.equal(isNoteRecord(contactNote()), true)
})

test('contact fields are available to local previews and future search', () => {
  assert.equal(
    noteBlocksToPlainText(contactNote().content.blocks),
    'Ana López\n+504 9999-0000\nana@example.com\nOANIX\nContacto de prueba',
  )
})

test('contact validation rejects malformed fields', () => {
  const invalid = contactNote() as unknown as { content: { blocks: Array<Record<string, unknown>> } }
  invalid.content.blocks[0].phone = 50499990000
  assert.equal(isNoteRecord(invalid), false)
})

test('empty optional contact text remains a valid private card', () => {
  const note = contactNote()
  const block = note.content.blocks[0]
  if (block.type !== 'contact') throw new Error('Expected contact block')
  block.phone = ''
  block.email = ''
  block.organization = ''
  block.notes = ''
  assert.equal(isNoteRecord(note), true)
  assert.equal(noteBlocksToPlainText(note.content.blocks), 'Ana López')
})
