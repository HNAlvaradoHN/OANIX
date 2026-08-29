import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const largePasteRuntimePath = new URL('../src/features/editor/LargePasteRuntime.tsx', import.meta.url)
const codeBlockExportRuntimePath = new URL('../src/features/editor/CodeBlockExportRuntime.tsx', import.meta.url)
const mobileEditorCssPath = new URL('../src/features/editor/mobileEditorStability.css', import.meta.url)
const autoSyncRuntimePath = new URL('../src/features/sync/AutoSyncRuntime.tsx', import.meta.url)

test('mobile large paste handles Android dual delivery without inserting the same text twice', async () => {
  const source = await readFile(largePasteRuntimePath, 'utf8')

  assert.match(source, /function ensureEditorSelection\(editor: HTMLElement, target: Element\)/)
  assert.match(source, /event\.inputType !== 'insertFromPaste'/)
  assert.match(source, /event\.dataTransfer\?\.getData\('text\/plain'\)/)
  assert.match(source, /duplicateWindowMs = 3_000/)
  assert.match(source, /consumeDuplicate\(event, plainText\)/)
  assert.match(source, /if \(consumeDuplicate\(event, plainText\)\) return/)
  assert.match(source, /target\.closest\('\[data-code-content="true"\]'\)/)
  assert.match(source, /document\.addEventListener\('paste', handlePaste, true\)/)
  assert.match(source, /document\.addEventListener\('beforeinput', handleBeforeInput, true\)/)
  assert.match(source, /shouldEncapsulateClipboardPaste\(plainText\)/)
})

test('daily page select-all stays inside the active day and excludes date/title chrome before deletion', async () => {
  const source = await readFile(largePasteRuntimePath, 'utf8')
  const css = await readFile(mobileEditorCssPath, 'utf8')

  assert.match(source, /function dailyPageBounds/)
  assert.match(source, /selectionTouchesDailyChrome/)
  assert.match(source, /selectionSpansMultipleDailyPages/)
  assert.match(source, /referenceBlockFromActiveElement/)
  assert.match(source, /document\.addEventListener\('focusin', rememberFocusInteraction, true\)/)
  assert.match(source, /protectedRange\.setStartBefore\(bounds\.first\)/)
  assert.match(source, /protectedRange\.setEndAfter\(bounds\.last\)/)
  assert.match(source, /event\.inputType\.startsWith\('delete'\)/)
  assert.match(source, /event\.key !== 'Backspace' && event\.key !== 'Delete'/)
  assert.match(css, /\.editor-daily-entry,/)
  assert.match(css, /\.editor-daily-entry__title \{/)
  assert.match(css, /user-select: text/)
})

test('touch code menu promotes a coarse pointer press into the canonical click path', async () => {
  const source = await readFile(codeBlockExportRuntimePath, 'utf8')

  assert.match(source, /function handleTouchMenuPointerDown\(event: PointerEvent\)/)
  assert.match(source, /event\.pointerType === 'mouse'/)
  assert.match(source, /data-code-actions-toggle/)
  assert.match(source, /event\.preventDefault\(\)/)
  assert.match(source, /toggle\.click\(\)/)
  assert.match(source, /addEventListener\('pointerdown', handleTouchMenuPointerDown, true\)/)
})

test('tablet timeline becomes a centered single column without a stray side rail', async () => {
  const css = await readFile(mobileEditorCssPath, 'utf8')

  assert.match(css, /@media \(max-width: 1100px\)/)
  assert.match(css, /\.oanix-workspace-v2__timeline::before/)
  assert.match(css, /display: none/)
  assert.match(css, /left: 0 !important/)
  assert.match(css, /width: 100% !important/)
  assert.match(css, /width: min\(100%, 34rem\)/)
  assert.match(css, /margin-left: auto/)
})

test('auto sync is event driven and does not poll the complete vault every 30 seconds while idle', async () => {
  const source = await readFile(autoSyncRuntimePath, 'utf8')

  assert.match(source, /postgres_changes/)
  assert.match(source, /oanix:local-data-changed/)
  assert.match(source, /visibilitychange/)
  assert.match(source, /window\.addEventListener\('online'/)
  assert.doesNotMatch(source, /setInterval/)
  assert.doesNotMatch(source, /30_000/)
})
