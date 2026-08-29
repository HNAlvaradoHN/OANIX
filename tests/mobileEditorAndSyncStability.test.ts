import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const largePasteRuntimePath = new URL('../src/features/editor/LargePasteRuntime.tsx', import.meta.url)
const codeBlockExportRuntimePath = new URL('../src/features/editor/CodeBlockExportRuntime.tsx', import.meta.url)
const codeBlockEditorPath = new URL('../src/features/editor/CodeBlockEditor.tsx', import.meta.url)
const mobileEditorCssPath = new URL('../src/features/editor/mobileEditorStability.css', import.meta.url)
const autoSyncRuntimePath = new URL('../src/features/sync/AutoSyncRuntime.tsx', import.meta.url)

test('mobile large paste handles Android dual delivery, empty payloads, and bulk insertText', async () => {
  const source = await readFile(largePasteRuntimePath, 'utf8')

  assert.match(source, /function ensureEditorSelection\(editor: HTMLElement, target: Element\)/)
  assert.match(source, /event\.inputType === 'insertText' && !event\.isComposing/)
  assert.match(source, /event\.inputType !== 'insertFromPaste'/)
  assert.match(source, /event\.dataTransfer\?\.getData\('text\/plain'\)/)
  assert.match(source, /duplicateWindowMs = 10_000/)
  assert.match(source, /isRecentHandledPaste/)
  assert.match(source, /consumeDuplicate\(event, plainText\)/)
  assert.match(source, /if \(consumeDuplicate\(event, plainText\)\) return/)
  assert.match(source, /navigator\.clipboard/)
  assert.match(source, /await clipboard\.readText\(\)/)
  assert.match(source, /document\.execCommand\('insertText', false, fallbackText\)/)
  assert.match(source, /document\.addEventListener\('paste', handlePaste, true\)/)
  assert.match(source, /document\.addEventListener\('beforeinput', handleBeforeInput, true\)/)
  assert.match(source, /shouldEncapsulateClipboardPaste\(bulkText\)/)
  assert.match(source, /shouldEncapsulateClipboardPaste\(fallbackText\)/)
})

test('select-all stays inside the active editable unit and protected islands stay outside the range', async () => {
  const source = await readFile(largePasteRuntimePath, 'utf8')
  const css = await readFile(mobileEditorCssPath, 'utf8')

  assert.match(source, /function editableSelectionUnit/)
  assert.match(source, /function selectionTouchesProtectedIsland/)
  assert.match(source, /function constrainSelectionToUnit/)
  assert.match(source, /\[data-daily-entry-block="true"\]/)
  assert.match(source, /\[data-code-block="true"\]/)
  assert.match(source, /\[data-checklist-block="true"\]/)
  assert.match(source, /document\.addEventListener\('focusin', rememberFocusInteraction, true\)/)
  assert.match(source, /document\.addEventListener\('selectionchange', guardSelectionBoundaries\)/)
  assert.match(source, /event\.key\.toLowerCase\(\) !== 'a'/)
  assert.match(source, /event\.inputType\.startsWith\('delete'\)/)
  assert.match(source, /event\.key !== 'Backspace' && event\.key !== 'Delete'/)
  assert.match(css, /\.editor-daily-entry,/)
  assert.match(css, /\.editor-daily-entry__title \{/)
  assert.match(css, /user-select: text/)
})

test('code menu keeps one toggle authority and promotes coarse pointerup into that click path', async () => {
  const exportSource = await readFile(codeBlockExportRuntimePath, 'utf8')
  const editorSource = await readFile(codeBlockEditorPath, 'utf8')

  assert.doesNotMatch(exportSource, /handleTouchMenuPointerDown/)
  assert.doesNotMatch(exportSource, /toggle\.click\(\)/)
  assert.doesNotMatch(exportSource, /addEventListener\('pointerdown'/)
  assert.match(exportSource, /data-code-export-txt/)
  assert.match(exportSource, /data-code-export-pdf/)
  assert.match(editorSource, /function handleCoarseTogglePointerUp/)
  assert.match(editorSource, /event\.pointerType === 'mouse'/)
  assert.match(editorSource, /actionToggle\.click\(\)/)
  assert.match(editorSource, /root\.addEventListener\('pointerup', handleCoarseTogglePointerUp, true\)/)
  assert.match(editorSource, /recentCoarsePromotion/)
  assert.match(editorSource, /event\.detail !== 0/)
  assert.match(editorSource, /const opening = menu\.hidden/)
  assert.match(editorSource, /menu\.hidden = false/)
  assert.match(editorSource, /aria-expanded', 'true'/)
})

test('timeline uses one centered layout authority at every width and collapses on narrow tablet', async () => {
  const css = await readFile(mobileEditorCssPath, 'utf8')

  assert.match(css, /\.oanix-workspace-v2 \.oanix-workspace-v2__timeline \{[\s\S]*margin-inline: auto !important;[\s\S]*left: auto !important;[\s\S]*transform: none !important;/)
  assert.match(css, /@media \(max-width: 1100px\)/)
  assert.match(css, /width: min\(calc\(100% - 2rem\), 46rem\)/)
  assert.match(css, /margin: 0 auto/)
  assert.match(css, /\.oanix-workspace-v2__timeline::before/)
  assert.match(css, /display: none/)
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
