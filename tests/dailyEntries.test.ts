import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createDailyEntryBlocks,
  localDateKey,
  prepareDailyEntriesForEditing,
} from '../src/features/notes/dailyEntries.ts'
import { isNoteRecord, type NoteRecord } from '../src/features/notes/noteTypes.ts'

function noteWith(blocks: NoteRecord['content']['blocks'], createdAt: string): NoteRecord {
  return {
    version: 1,
    id: 'note-daily-entry-test',
    title: 'Bitácora',
    createdAt,
    updatedAt: createdAt,
    content: { format: 'blocks-v1', blocks },
  }
}

test('localDateKey changes at the local calendar day boundary', () => {
  assert.equal(localDateKey(new Date(2026, 7, 15, 23, 59, 59)), '2026-08-15')
  assert.equal(localDateKey(new Date(2026, 7, 16, 0, 0, 1)), '2026-08-16')
})

test('new daily entry blocks are valid stored note blocks', () => {
  const [entry, paragraph] = createDailyEntryBlocks(new Date(2026, 7, 15, 12, 0, 0))
  assert.equal(entry.type, 'dailyEntry')
  assert.equal(entry.date, '2026-08-15')
  assert.equal(isNoteRecord(noteWith([entry, paragraph], new Date(2026, 7, 15).toISOString())), true)
})

test('legacy notes get their original day marker and todays continuation', () => {
  const created = new Date(2026, 7, 14, 10, 0, 0)
  const note = noteWith([{ id: 'paragraph-old', type: 'paragraph', runs: [{ text: 'Ayer' }] }], created.toISOString())
  const blocks = prepareDailyEntriesForEditing(note, new Date(2026, 7, 15, 9, 0, 0))
  const entries = blocks.filter((block) => block.type === 'dailyEntry')

  assert.equal(entries.length, 2)
  assert.equal(entries[0].type === 'dailyEntry' ? entries[0].date : '', '2026-08-14')
  assert.equal(entries[1].type === 'dailyEntry' ? entries[1].date : '', '2026-08-15')
  assert.equal(blocks.some((block) => block.type === 'paragraph' && block.runs.some((run) => run.text === 'Ayer')), true)
})

test('opening the same note again on the same day does not duplicate the marker', () => {
  const [entry, paragraph] = createDailyEntryBlocks(new Date(2026, 7, 15, 8, 0, 0))
  const note = noteWith([entry, paragraph], new Date(2026, 7, 15, 8, 0, 0).toISOString())
  const blocks = prepareDailyEntriesForEditing(note, new Date(2026, 7, 15, 20, 0, 0))
  assert.equal(blocks.filter((block) => block.type === 'dailyEntry').length, 1)
})

test('daily-entry validation rejects malformed dates', () => {
  const note = noteWith([{ id: 'entry-invalid', type: 'dailyEntry', date: '15/08/2026', title: '' } as never], new Date().toISOString())
  assert.equal(isNoteRecord(note), false)
})
