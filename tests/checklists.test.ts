import assert from 'node:assert/strict'
import test from 'node:test'

import { isNoteRecord, noteBlocksToPlainText, type NoteRecord } from '../src/features/notes/noteTypes.ts'

function checklistNote(): NoteRecord {
  return {
    version: 1,
    id: 'note-checklist-test',
    title: 'Compras',
    createdAt: '2026-08-15T00:00:00.000Z',
    updatedAt: '2026-08-15T00:00:00.000Z',
    content: {
      format: 'blocks-v1',
      blocks: [{
        id: 'checklist-block-1',
        type: 'checklist',
        items: [
          { text: 'Comprar café', checked: false },
          { text: 'Pagar recibo', checked: true },
        ],
      }],
    },
  }
}

test('checklist blocks survive note validation', () => {
  assert.equal(isNoteRecord(checklistNote()), true)
})

test('checklist state is represented in note previews and search text', () => {
  assert.equal(
    noteBlocksToPlainText(checklistNote().content.blocks),
    '☐ Comprar café\n☑ Pagar recibo',
  )
})

test('checklist validation rejects malformed item state', () => {
  const invalid = checklistNote() as unknown as { content: { blocks: Array<Record<string, unknown>> } }
  invalid.content.blocks[0].items = [{ text: 'Tarea', checked: 'yes' }]
  assert.equal(isNoteRecord(invalid), false)
})
