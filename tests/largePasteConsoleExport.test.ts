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
const browserPdfPath = new URL('../src/features/editor/browserPdfExport.ts', import.meta.url)
const outboundSharePath = new URL('../src/platform/android/outboundShare.ts', import.meta.url)

const androidOutboundPluginPath = new URL(
  '../android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixOutboundSharePlugin.java',
  import.meta.url,
)

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

test('large paste interception handles paste delivery without hijacking ordinary typing', async () => {
  const source = await readFile(largePasteRuntimePath, 'utf8')
  assert.match(source, /document\.addEventListener\('paste', handlePaste, true\)/)
  assert.match(source, /document\.addEventListener\('beforeinput', handleBeforeInput, true\)/)
  assert.match(source, /event\.inputType !== 'insertFromPaste'/)
  assert.match(source, /target\.closest\('\[data-code-content="true"\]'\)/)
  assert.match(source, /shouldEncapsulateClipboardPaste\(plainText\)/)
  assert.match(source, /codeTool\.click\(\)/)
  assert.match(source, /content\.textContent = plainText/)
  assert.doesNotMatch(source, /document\.addEventListener\('input'/)
  assert.doesNotMatch(source, /document\.addEventListener\('keyup'/)
})

test('code block menu exports real TXT/PDF files without the browser print route', async () => {
  const runtime = await readFile(exportRuntimePath, 'utf8')
  const service = await readFile(exportServicePath, 'utf8')
  const pdf = await readFile(browserPdfPath, 'utf8')

  assert.match(runtime, /delete convert\.dataset\.codeConvert/)
  assert.match(runtime, /convert\.textContent = 'Exportar TXT'/)
  assert.match(runtime, /exportPdf\.textContent = 'Exportar PDF'/)
  assert.match(runtime, /Preparando archivo PDF/)
  assert.match(service, /downloadBlob\(pdf, fileName\)/)
  assert.match(service, /createBrowserTextPdf\(text, title\)/)
  assert.doesNotMatch(service, /\.print\(/)
  assert.match(pdf, /new Blob\(chunks, \{ type: 'application\/pdf' \}\)/)
  assert.match(pdf, /requestAnimationFrame/)
})

test('Android export uses the native share sheet for TXT and generated PDF files', async () => {
  const bridge = await readFile(outboundSharePath, 'utf8')
  const plugin = await readFile(androidOutboundPluginPath, 'utf8')

  assert.match(bridge, /shareTextFileOnAndroid/)
  assert.match(bridge, /sharePdfTextOnAndroid/)
  assert.match(plugin, /void shareTextFile\(PluginCall call\)/)
  assert.match(plugin, /void sharePdfText\(PluginCall call\)/)
  assert.match(plugin, /new PdfDocument\(\)/)
  assert.match(plugin, /Intent\.EXTRA_STREAM/)
  assert.match(plugin, /FLAG_GRANT_READ_URI_PERMISSION/)
  assert.match(plugin, /new Thread\(/)
})
