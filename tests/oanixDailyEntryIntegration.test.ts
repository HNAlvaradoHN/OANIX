import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const guard = readFileSync('src/features/editor/implementations/OanixNotesSheetMobileGuard.tsx', 'utf8')
const card = readFileSync('src/features/editor/implementations/OanixDailyEntryBlockCard.tsx', 'utf8')
const mixed = readFileSync('src/features/editor/implementations/OanixMixedDocumentWithFiles.tsx', 'utf8')
const projection = readFileSync('src/features/editor/oanixMixedDocumentProjection.ts', 'utf8')

test('Entrada menu action is connected without bypassing pending autosave', () => {
  assert.match(guard, /button\[data-tool="entry"\]/)
  assert.match(guard, /waitForEditorClean/)
  assert.match(guard, /insertOanixDailyEntryBlock/)
  assert.match(guard, /mode: 'plain'/)
  assert.match(guard, /mode: 'mixed'/)
  assert.match(guard, /setSurfaceRevision/)
})

test('daily entry exposes a calendar picker that can change persisted date', () => {
  assert.match(card, /type="date"/)
  assert.match(card, /Cambiar fecha de la entrada/)
  assert.match(card, /showPicker/)
  assert.match(card, /updateDate/)
  assert.match(card, /formatDailyEntryDate/)
})

test('daily entry remains an atomic block with local title and text editors', () => {
  assert.match(card, /data-editor-atomic-block="true"/)
  assert.match(card, /data-editor-local-editable="true"/)
  assert.match(card, /Título \(opcional\)/)
  assert.match(card, /Escribe esta entrada…/)
})

test('mixed document projection and renderer recognize daily entries', () => {
  assert.match(projection, /type: 'daily-entry'/)
  assert.match(projection, /decodeDailyEntryBlock/)
  assert.match(mixed, /OanixDailyEntryBlockCard/)
  assert.match(mixed, /segment\.type === 'daily-entry'/)
})
