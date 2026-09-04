import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const guard = readFileSync('src/features/editor/implementations/OanixNotesSheetMobileGuard.tsx', 'utf8')
const card = readFileSync('src/features/editor/implementations/OanixDailyEntryBlockCard.tsx', 'utf8')
const cardCss = readFileSync('src/features/editor/implementations/oanixDailyEntryBlockCard.css', 'utf8')
const checklistCss = readFileSync('src/features/editor/implementations/oanixChecklistBlockCard.css', 'utf8')
const mobileCss = readFileSync('src/features/editor/implementations/oanixNotesSheetMobileSafeArea.css', 'utf8')
const mixed = readFileSync('src/features/editor/implementations/OanixMixedDocumentWithFiles.tsx', 'utf8')
const projection = readFileSync('src/features/editor/oanixMixedDocumentProjection.ts', 'utf8')

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
  assert.match(cardCss, /var\(--accent,#f97316\)/)
  assert.match(cardCss, /linear-gradient\(145deg/)
  assert.match(cardCss, /oanix-daily-entry::before/)
  assert.match(cardCss, /box-shadow:0 16px 38px/)
  assert.doesNotMatch(cardCss, /var\(--oanix-note-text/)
})

test('side-menu locator keeps its theme accent and adds a subtle visible glow', () => {
  assert.match(mobileCss, /oanix-notes__slide-indicator::after/)
  assert.match(mobileCss, /var\(--accent\)/)
  assert.match(mobileCss, /0 0 6px color-mix/)
  assert.match(mobileCss, /0 0 12px color-mix/)
})

test('checklist derives contrast from the active editor theme instead of stale fallback variables', () => {
  assert.match(checklistCss, /var\(--color-surface,#fff\)/)
  assert.match(checklistCss, /var\(--color-text,#182033\)/)
  assert.match(checklistCss, /var\(--color-text-secondary,#64748b\)/)
  assert.match(checklistCss, /var\(--color-placeholder,#94a3b8\)/)
  assert.doesNotMatch(checklistCss, /var\(--oanix-text/)
  assert.doesNotMatch(checklistCss, /var\(--oanix-sheet/)
})

test('Entrada remount preserves the selected mode and exact sheet theme', () => {
  assert.match(guard, /captureEditorVisualState/)
  assert.match(guard, /restoreEditorVisualState/)
  assert.match(guard, /pendingVisualStateRef/)
  assert.match(guard, /\.oanix-notes__mode-row button\.is-active/)
  assert.match(guard, /\.oanix-notes__theme-preview\.theme-/)
  assert.match(guard, /pendingVisualStateRef\.current = captureEditorVisualState\(editor\)/)
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

test('daily entry exposes deletion and removes its persisted block plus order entry', () => {
  assert.match(card, /Eliminar entrada/)
  assert.match(card, /window\.confirm\('¿Eliminar esta entrada\?'\)/)
  assert.match(card, /oanix-daily-entry-remove/)
  assert.match(guard, /handleDailyEntryRemove/)
  assert.match(guard, /block\.kind === 'dailyEntry'/)
  assert.match(guard, /deletes: \[blockId\]/)
  assert.match(guard, /order: nextBlocks\.map\(\(block\) => block\.id\)/)
  assert.match(guard, /setSurfaceRevision/)
})

test('mixed document projection and renderer recognize daily entries', () => {
  assert.match(projection, /type: 'daily-entry'/)
  assert.match(projection, /decodeDailyEntryBlock/)
  assert.match(mixed, /OanixDailyEntryBlockCard/)
  assert.match(mixed, /segment\.type === 'daily-entry'/)
})
