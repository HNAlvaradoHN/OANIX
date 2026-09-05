import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import type { EditorSurfaceBlockChangeSet } from '../src/features/editor/editorSurfaceContract.ts'
import {
  applyTextLineFormat,
  backspaceTextLineBoundary,
  enterTextLine,
  normalizeTextLines,
} from '../src/features/editor/oanixTextLineModel.ts'
import { applyOanixTextFormat } from '../src/features/editor/oanixTextFormatLayer.ts'
import { TEXT_BLOCK_KIND, decodeTextBlock, encodeTextBlock, type EditorTextBlock } from '../src/features/editor/textBlockCodec.ts'

function line(id: string, text: string, format: EditorTextBlock['format'] = 'paragraph'): EditorTextBlock {
  return { id, kind: TEXT_BLOCK_KIND, text, format }
}

test('legacy text blocks decode as paragraph without migration', () => {
  const block = decodeTextBlock({ id: 'legacy', kind: TEXT_BLOCK_KIND, data: { text: 'hola' } })
  assert.equal(block?.format, 'paragraph')
  assert.deepEqual(encodeTextBlock(line('p', 'hola')).data, { text: 'hola' })
})

test('plain notes can still enter the rich text document safely', async () => {
  let changes: EditorSurfaceBlockChangeSet | null = null
  let snapshotText = 'not-saved'
  const result = await applyOanixTextFormat({
    mode: 'plain',
    format: 'h2',
    title: 'Nota',
    text: 'uno\ndos\ntres',
    selectionStart: 5,
    selectionEnd: 5,
    existingBlocks: [],
    createId: (index) => `t-${index}`,
    saveBlockChanges: async (next) => { changes = next; return true },
    savePlainSnapshot: async (snapshot) => { snapshotText = snapshot.text; return true },
  })

  assert.equal(result.status, 'committed')
  assert.equal(snapshotText, '')
  assert.ok((changes?.upserts?.length ?? 0) >= 2)
})

test('stored paragraph newlines normalize to independent natural lines', () => {
  let id = 0
  const normalized = normalizeTextLines([line('source', 'uno\ndos\ntres')], () => `new-${++id}`)
  assert.equal(normalized.changed, true)
  assert.deepEqual(normalized.lines.map((item) => [item.id, item.text, item.format]), [
    ['source', 'uno', 'paragraph'],
    ['new-1', 'dos', 'paragraph'],
    ['new-2', 'tres', 'paragraph'],
  ])
})

test('H2 without selection on a written line creates the next H2 line and keeps current text untouched', () => {
  const result = applyTextLineFormat([line('p1', 'Texto')], 'p1', 5, 5, 'h2', () => 'h2-1')
  assert.ok(result)
  assert.deepEqual(result.lines.map((item) => [item.id, item.text, item.format]), [
    ['p1', 'Texto', 'paragraph'],
    ['h2-1', '', 'h2'],
  ])
  assert.equal(result.focusBlockId, 'h2-1')
  assert.equal(result.focusOffset, 0)
})

test('H3 on an empty line converts that same line instead of creating another gap', () => {
  const result = applyTextLineFormat([line('p1', '')], 'p1', 0, 0, 'h3', () => 'unused')
  assert.ok(result)
  assert.equal(result.lines.length, 1)
  assert.equal(result.lines[0].id, 'p1')
  assert.equal(result.lines[0].format, 'h3')
})

test('selected text converts its complete line and preserves the complete line text', () => {
  const source = [line('p1', 'Texto completo')]
  const result = applyTextLineFormat(source, 'p1', 2, 7, 'h2', () => 'unused')
  assert.ok(result)
  assert.equal(result.lines.length, 1)
  assert.equal(result.lines[0].text, 'Texto completo')
  assert.equal(result.lines[0].format, 'h2')
})

test('Enter from H2 keeps the heading before the caret and creates a paragraph below', () => {
  const result = enterTextLine([line('h', 'Título final', 'h2')], 'h', 6, 6, () => 'p2')
  assert.ok(result)
  assert.deepEqual(result.lines.map((item) => [item.id, item.text, item.format]), [
    ['h', 'Título', 'h2'],
    ['p2', ' final', 'paragraph'],
  ])
  assert.equal(result.focusBlockId, 'p2')
  assert.equal(result.focusOffset, 0)
})

test('Enter that leaves a heading empty restores the old line to paragraph priority', () => {
  const result = enterTextLine([line('h', 'Título', 'h3')], 'h', 0, 0, () => 'p2')
  assert.ok(result)
  assert.equal(result.lines[0].format, 'paragraph')
  assert.equal(result.lines[0].text, '')
  assert.equal(result.lines[1].format, 'paragraph')
  assert.equal(result.lines[1].text, 'Título')
})

test('Backspace at a line boundary crosses H2/H3 without stopping and preserves the join caret', () => {
  const source = [
    line('p0', 'Arriba'),
    line('h2', 'Título', 'h2'),
    line('p1', 'abajo'),
  ]
  const first = backspaceTextLineBoundary(source, 'p1')
  assert.ok(first)
  assert.equal(first.focusBlockId, 'h2')
  assert.equal(first.focusOffset, 6)
  assert.equal(first.lines[1].text, 'Títuloabajo')
  assert.equal(first.lines[1].format, 'h2')

  const second = backspaceTextLineBoundary(first.lines, 'h2')
  assert.ok(second)
  assert.equal(second.focusBlockId, 'p0')
  assert.equal(second.lines.length, 1)
  assert.equal(second.lines[0].text, 'ArribaTítuloabajo')
})

test('empty heading resulting from line normalization is paragraph immediately', () => {
  const normalized = normalizeTextLines([line('h', '', 'h2')], () => 'unused')
  assert.equal(normalized.lines[0].format, 'paragraph')
})

test('new line editor owns focus, Backspace and scrolling without the old remount bridge', () => {
  const editor = readFileSync('src/features/editor/implementations/OanixTextLineEditor.tsx', 'utf8')
  const host = readFileSync('src/features/editor/EditorSurface.tsx', 'utf8')
  const css = readFileSync('src/features/editor/implementations/oanixNotesSheetMobileSafeArea.css', 'utf8')

  assert.equal(existsSync('src/features/editor/oanixTextBehaviorBridge.ts'), false)
  assert.doesNotMatch(host, /behaviorRevision|installOanixTextBehaviorBridge/)
  assert.match(editor, /event\.key !== 'Backspace'/)
  assert.match(editor, /focus\(\{ preventScroll: true \}\)/)
  assert.match(editor, /scrollIntoView\(\{ block: 'nearest' \}\)/)
  assert.match(editor, /stopImmediatePropagation\(\)/)
  assert.match(editor, /value=\{line\.text\}/)
  assert.match(css, /--oanix-h2-ruled-step: 42px/)
  assert.match(css, /--oanix-h3-ruled-step: 36px/)
  assert.match(css, /line-height: var\(--oanix-h2-ruled-step\)/)
  assert.match(css, /line-height: var\(--oanix-h3-ruled-step\)/)
})

test('paragraph ruling keeps text cadence locked to the page line and no focus box', () => {
  const css = readFileSync('src/features/editor/implementations/oanixNotesSheetMobileSafeArea.css', 'utf8')
  assert.match(css, /--oanix-ruled-step:\s*30px/)
  assert.match(css, /line-height:\s*var\(--oanix-ruled-step\)/)
  assert.match(css, /background-size:\s*100% var\(--oanix-ruled-step\)/)
  assert.match(css, /repeating-linear-gradient/)
  assert.match(css, /box-shadow:\s*none/)
  assert.match(css, /border-radius:\s*0/)
})
