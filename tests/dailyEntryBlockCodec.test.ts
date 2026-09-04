import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DAILY_ENTRY_BLOCK_KIND,
  decodeDailyEntryBlock,
  encodeDailyEntryBlock,
  formatDailyEntryDate,
  isValidDailyEntryDate,
  localDailyEntryDateKey,
} from '../src/features/editor/dailyEntryBlockCodec.ts'

test('daily entry codec preserves date, optional title and text', () => {
  const encoded = encodeDailyEntryBlock({
    id: 'entry-1',
    kind: DAILY_ENTRY_BLOCK_KIND,
    date: '2026-09-04',
    title: 'Turno A',
    text: 'Se revisó la línea de producción.',
  })
  assert.deepEqual(decodeDailyEntryBlock(encoded), {
    id: 'entry-1',
    kind: DAILY_ENTRY_BLOCK_KIND,
    date: '2026-09-04',
    title: 'Turno A',
    text: 'Se revisó la línea de producción.',
  })
})

test('daily entry date validation rejects impossible calendar dates', () => {
  assert.equal(isValidDailyEntryDate('2026-02-29'), false)
  assert.equal(isValidDailyEntryDate('2028-02-29'), true)
  assert.equal(isValidDailyEntryDate('2026-13-01'), false)
  assert.equal(isValidDailyEntryDate('2026-09-04'), true)
})

test('local daily entry date key uses local calendar components without UTC conversion', () => {
  const date = new Date(2026, 8, 4, 23, 30, 0)
  assert.equal(localDailyEntryDateKey(date), '2026-09-04')
})

test('daily entry date label is human readable in Spanish', () => {
  const label = formatDailyEntryDate('2026-09-04').toLocaleLowerCase('es-HN')
  assert.match(label, /4/)
  assert.match(label, /septiembre/)
  assert.match(label, /2026/)
})
