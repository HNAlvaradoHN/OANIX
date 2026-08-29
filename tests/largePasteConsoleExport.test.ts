import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  LARGE_PASTE_CHARACTER_THRESHOLD,
  LARGE_PASTE_LINE_THRESHOLD,
  shouldEncapsulateClipboardPaste,
} from '../src/features/editor/largePastePolicy.ts'

const largePasteRuntimePath = new URL('../src/features/editor/LargePasteRuntime.tsx', import.meta.url)
const exportRuntimePath = new URL('../src/features/editor/CodeBlockExportRuntime.tsx', import.meta.url)
const exportServicePath = new URL('../src/features/editor/codeBlockExport.ts', import.meta.url)

test('large paste policy protects the editor at 50 pasted lines only', () => {
  assert.equal(LARGE_PASTE_LINE_THRESHOLD, 50)
  assert.equal(shouldEncapsulateClipboardPaste(Array.from({ length: 49 }, () => 'línea').join('\n')), false)
  assert.equal(shouldEncapsulateClipboardPaste(Array.from({ length: 50 }, () => 'línea').join('\n')), true)
  assert.equal(shouldEncapsulateClipboardPaste('una sola línea'), false)
})

test('very long single-line clipboard content is also encapsulated', () => {
  assert.equal(LARGE_PASTE_CHARACTER_THRESHOLD, 64 * 1024)
  assert.equal(shouldEncapsulateClipboardPaste('x'.repeat(LARGE_PASTE_CHARACTER_THRESHOLD - 1)), false)
  assert.equal(shouldEncapsulateClipboardPaste('x'.repeat(LARGE_PASTE_CHARACTER_THRESHOLD)), true)
})

test('large paste interception is scoped to paste events and leaves existing code blocks alone', async () => {
  const source = await readFile(largePasteRuntimePath, 'utf8')
  assert.match(source, /document\.addEventListener\('paste', handlePaste, true\)/)
  assert.match(source, /target\.closest\('\[data-code-content="true"\]'\)/)
  assert.match(source, /shouldEncapsulateClipboardPaste\(plainText\)/)
  assert.match(source, /codeTool\.click\(\)/)
  assert.match(source, /content\.textContent = plainText/)
  assert.doesNotMatch(source, /addEventListener\('(input|keyup|keydown)'/)
})

test('code block menu replaces convert-to-text with TXT and PDF exports', async () => {
  const runtime = await readFile(exportRuntimePath, 'utf8')
  const service = await readFile(exportServicePath, 'utf8')

  assert.match(runtime, /delete convert\.dataset\.codeConvert/)
  assert.match(runtime, /convert\.textContent = 'Exportar TXT'/)
  assert.match(runtime, /exportPdf\.textContent = 'Exportar PDF'/)
  assert.match(service, /anchor\.download = `\$\{exportStem\(language\)\}\.txt`/)
  assert.match(service, /printWindow\.print\(\)/)
  assert.match(service, /pre\.textContent = text/)
})
