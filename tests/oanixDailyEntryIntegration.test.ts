import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const guard = readFileSync('src/features/editor/implementations/OanixNotesSheetMobileGuard.tsx', 'utf8')
const card = readFileSync('src/features/editor/implementations/OanixDailyEntryBlockCard.tsx', 'utf8')
const cardCss = readFileSync('src/features/editor/implementations/oanixDailyEntryBlockCard.css', 'utf8')
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

test('daily entry is visually framed and derives surface/text from the active theme', () => {
  assert.match(cardCss, /border:1px solid color-mix/)
  assert.match(cardCss, /border-radius:18px/)
  assert.match(cardCss, /var\(--color-surface,#fff\)/)
  assert.match(cardCss, /color:var\(--color-text,#182033\)/)
  assert.doesNotMatch(cardCss, /var\(--oanix-note-text/)
})

test('all add-content tools suppress automatic soft-keyboard refocus until an explicit editing gesture', () => {
  for (const tool of ['entry', 'image', 'files', 'code', 'checklist', 'contact', 'separator']) {
    assert.match(guard, new RegExp(`['"]${tool}['"]`))
  }
  assert.match(guard, /ADD_CONTENT_TOOLS/)
  assert.match(guard, /suppressToolKeyboardRef/)
  assert.match(guard, /handleToolClickCapture/)
  assert.match(guard, /handlePointerDownCapture/)
  assert.match(guard, /handleFocusInCapture/)
  assert.match(guard, /event\.target\.blur\(\)/)
  assert.doesNotMatch(guard, /oanix-daily-entry__title'\)\?\.focus/)
})

test('mixed document projection and renderer recognize daily entries', () => {
  assert.match(projection, /type: 'daily-entry'/)
  assert.match(projection, /decodeDailyEntryBlock/)
  assert.match(mixed, /OanixDailyEntryBlockCard/)
  assert.match(mixed, /segment\.type === 'daily-entry'/)
})
