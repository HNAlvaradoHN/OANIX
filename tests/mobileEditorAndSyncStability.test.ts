import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const largePasteRuntimePath = new URL('../src/features/editor/LargePasteRuntime.tsx', import.meta.url)
const mobileEditorCssPath = new URL('../src/features/editor/mobileEditorStability.css', import.meta.url)
const autoSyncRuntimePath = new URL('../src/features/sync/AutoSyncRuntime.tsx', import.meta.url)

test('mobile large paste handles both ClipboardEvent and Android insertFromPaste beforeinput', async () => {
  const source = await readFile(largePasteRuntimePath, 'utf8')

  assert.match(source, /function ensureEditorSelection\(editor: HTMLElement, target: Element\)/)
  assert.match(source, /event\.inputType !== 'insertFromPaste'/)
  assert.match(source, /event\.dataTransfer\?\.getData\('text\/plain'\)/)
  assert.match(source, /document\.addEventListener\('paste', handlePaste, true\)/)
  assert.match(source, /document\.addEventListener\('beforeinput', handleBeforeInput, true\)/)
  assert.match(source, /shouldEncapsulateClipboardPaste\(plainText\)/)
})

test('daily page select-all stays inside the last interacted day and excludes date chrome', async () => {
  const source = await readFile(largePasteRuntimePath, 'utf8')
  const css = await readFile(mobileEditorCssPath, 'utf8')

  assert.match(source, /function dailyPageBounds/)
  assert.match(source, /selectionTouchesDailyChrome/)
  assert.match(source, /range\.setStartBefore\(bounds\.first\)/)
  assert.match(source, /range\.setEndAfter\(bounds\.last\)/)
  assert.match(source, /event\.inputType\.startsWith\('delete'\)/)
  assert.match(css, /\.editor-daily-entry,/)
  assert.match(css, /\.editor-daily-entry__title \{/)
  assert.match(css, /user-select: text/)
})

test('code actions keep touch-sized targets and tablet timeline collapses before cards can clip', async () => {
  const css = await readFile(mobileEditorCssPath, 'utf8')

  assert.match(css, /touch-action: manipulation/)
  assert.match(css, /@media \(pointer: coarse\)/)
  assert.match(css, /@media \(max-width: 1100px\)/)
  assert.match(css, /left: 0 !important/)
  assert.match(css, /width: 100% !important/)
  assert.match(css, /width: min\(100%, 34rem\)/)
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
