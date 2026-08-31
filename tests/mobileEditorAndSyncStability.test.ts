import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const largePasteRuntimePath = new URL('../src/features/editor/LargePasteRuntime.tsx', import.meta.url)
const richTextEditorPath = new URL('../src/features/editor/RichTextEditor.tsx', import.meta.url)
const imageNoteEditorPath = new URL('../src/features/images/ImageNoteEditor.tsx', import.meta.url)
const codeBlockExportRuntimePath = new URL('../src/features/editor/CodeBlockExportRuntime.tsx', import.meta.url)
const codeBlockEditorPath = new URL('../src/features/editor/CodeBlockEditor.tsx', import.meta.url)
const mobileEditorCssPath = new URL('../src/features/editor/mobileEditorStability.css', import.meta.url)
const autoSyncRuntimePath = new URL('../src/features/sync/AutoSyncRuntime.tsx', import.meta.url)

test('mobile large paste handles Android dual delivery and verifies bulk insertText against clipboard', async () => {
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
  assert.match(source, /clipboardText === bulkText/)
  assert.match(source, /document\.execCommand\('insertText', false, bulkText\)/)
  assert.match(source, /document\.execCommand\('insertText', false, fallbackText\)/)
  assert.match(source, /document\.addEventListener\('paste', handlePaste, true\)/)
  assert.match(source, /document\.addEventListener\('beforeinput', handleBeforeInput, true\)/)
  assert.match(source, /shouldEncapsulateClipboardPaste\(bulkText\)/)
  assert.match(source, /shouldEncapsulateClipboardPaste\(fallbackText\)/)
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

test('editor stability css does not own workspace timeline geometry', async () => {
  const css = await readFile(mobileEditorCssPath, 'utf8')

  assert.doesNotMatch(css, /oanix-workspace-v2__timeline/)
  assert.doesNotMatch(css, /oanix-workspace-v2__timeline-item/)
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
