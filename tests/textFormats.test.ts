import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type { EditorSurfaceBlockChangeSet } from '../src/features/editor/editorSurfaceContract.ts'
import { applyOanixTextFormat } from '../src/features/editor/oanixTextFormatLayer.ts'
import { TEXT_BLOCK_KIND, decodeTextBlock, encodeTextBlock } from '../src/features/editor/textBlockCodec.ts'

test('legacy text blocks decode as paragraph without migration', () => {
  const block = decodeTextBlock({ id: 'legacy', kind: TEXT_BLOCK_KIND, data: { text: 'hola' } })
  assert.equal(block?.format, 'paragraph')
  assert.deepEqual(encodeTextBlock({ id: 'p', kind: TEXT_BLOCK_KIND, text: 'hola', format: 'paragraph' }).data, { text: 'hola' })
})

test('plain formatting promotes the selected line and preserves surrounding text', async () => {
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
  assert.equal(changes?.upserts?.length, 3)
  const decoded = changes?.upserts?.map((block) => decodeTextBlock(block)) ?? []
  assert.deepEqual(decoded.map((block) => [block?.text, block?.format]), [
    ['uno', 'paragraph'],
    ['dos', 'h2'],
    ['tres', 'paragraph'],
  ])
})

test('mixed multi-line selection creates one semantic list item per selected line', async () => {
  const original = encodeTextBlock({ id: 'source', kind: TEXT_BLOCK_KIND, text: 'a\nb\nc', format: 'paragraph' })
  let changes: EditorSurfaceBlockChangeSet | null = null
  const result = await applyOanixTextFormat({
    mode: 'mixed',
    format: 'list',
    blocks: [original],
    targetTextBlockId: 'source',
    selectionStart: 0,
    selectionEnd: 3,
    createId: (index) => `m-${index}`,
    saveBlockChanges: async (next) => { changes = next; return true },
  })

  assert.equal(result.status, 'committed')
  assert.deepEqual(changes?.deletes, ['source'])
  const decoded = changes?.upserts?.map((block) => decodeTextBlock(block)) ?? []
  assert.deepEqual(decoded.map((block) => [block?.text, block?.format]), [
    ['a', 'list'],
    ['b', 'list'],
    ['c', 'paragraph'],
  ])
})

test('editor bridge connects every text format and keeps theme-driven visuals', () => {
  const guard = readFileSync('src/features/editor/implementations/OanixNotesSheetMobileGuard.tsx', 'utf8')
  const css = readFileSync('src/features/editor/implementations/oanixNotesSheetMobileSafeArea.css', 'utf8')

  for (const format of ['paragraph', 'h2', 'h3', 'quote', 'list', 'numbered-list']) {
    assert.match(guard, new RegExp(`['"]${format}['"]`))
    assert.match(css, new RegExp(`data-oanix-text-format=\\"${format}\\"`))
  }
  assert.match(guard, /applyOanixTextFormat/)
  assert.match(guard, /lastPlainSelectionRef/)
  assert.match(guard, /lastMixedSelectionRef/)
  assert.match(css, /var\(--accent\)/)
  assert.match(css, /var\(--color-text\)/)
  assert.match(css, /tool-h2::after/)
  assert.match(css, /content: "H2"/)
})
