import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type { EditorSurfaceBlockChangeSet } from '../src/features/editor/editorSurfaceContract.ts'
import { buildHeadingEnterPlan, buildHeadingParagraphReset } from '../src/features/editor/oanixHeadingEnterPlan.ts'
import { applyOanixTextFormat } from '../src/features/editor/oanixTextFormatLayer.ts'
import { TEXT_BLOCK_KIND, decodeTextBlock, encodeTextBlock } from '../src/features/editor/textBlockCodec.ts'

test('legacy text blocks decode as paragraph without migration', () => {
  const block = decodeTextBlock({ id: 'legacy', kind: TEXT_BLOCK_KIND, data: { text: 'hola' } })
  assert.equal(block?.format, 'paragraph')
  assert.deepEqual(encodeTextBlock({ id: 'p', kind: TEXT_BLOCK_KIND, text: 'hola', format: 'paragraph' }).data, { text: 'hola' })
})

test('H2 without selection creates a new empty heading after the current plain line', async () => {
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
  const decoded = changes?.upserts?.map((block) => decodeTextBlock(block)) ?? []
  assert.deepEqual(decoded.map((block) => [block?.text, block?.format]), [
    ['uno\ndos', 'paragraph'],
    ['', 'h2'],
    ['tres', 'paragraph'],
  ])
})

test('H3 without selection inserts the new heading after the active mixed line and keeps that line unchanged', async () => {
  const original = encodeTextBlock({ id: 'source', kind: TEXT_BLOCK_KIND, text: 'uno\ndos\ntres', format: 'paragraph' })
  let changes: EditorSurfaceBlockChangeSet | null = null
  const result = await applyOanixTextFormat({
    mode: 'mixed',
    format: 'h3',
    blocks: [original],
    targetTextBlockId: 'source',
    selectionStart: 5,
    selectionEnd: 5,
    createId: (index) => `m-${index}`,
    saveBlockChanges: async (next) => { changes = next; return true },
  })

  assert.equal(result.status, 'committed')
  assert.equal(changes?.deletes, undefined)
  const decoded = changes?.upserts?.map((block) => decodeTextBlock(block)) ?? []
  assert.deepEqual(decoded.map((block) => [block?.id, block?.text, block?.format]), [
    ['source', 'uno\ndos', 'paragraph'],
    ['m-0', '', 'h3'],
    ['m-1', 'tres', 'paragraph'],
  ])
})

test('selecting text converts that text line and its ruling to H2', async () => {
  const original = encodeTextBlock({ id: 'source', kind: TEXT_BLOCK_KIND, text: 'uno\ndos\ntres', format: 'paragraph' })
  let changes: EditorSurfaceBlockChangeSet | null = null
  const result = await applyOanixTextFormat({
    mode: 'mixed',
    format: 'h2',
    blocks: [original],
    targetTextBlockId: 'source',
    selectionStart: 5,
    selectionEnd: 7,
    createId: (index) => `s-${index}`,
    saveBlockChanges: async (next) => { changes = next; return true },
  })

  assert.equal(result.status, 'committed')
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

test('live H2/H3 state wins when Enter lands before the persisted format catches up', () => {
  const persistedParagraph = encodeTextBlock({ id: 'source', kind: TEXT_BLOCK_KIND, text: 'viejo', format: 'paragraph' })
  const plan = buildHeadingEnterPlan([persistedParagraph], 'source', 5, 5, () => 'next', 'Título', 'h2')
  assert.ok(plan)
  assert.equal(decodeTextBlock(plan.heading)?.format, 'h2')
  assert.equal(decodeTextBlock(plan.heading)?.text, 'Títul')
  assert.equal(decodeTextBlock(plan.paragraph)?.format, 'paragraph')
  assert.equal(decodeTextBlock(plan.paragraph)?.text, 'o')
})

test('empty heading reset always canonicalizes the writable text block back to paragraph', () => {
  const persistedHeading = encodeTextBlock({ id: 'source', kind: TEXT_BLOCK_KIND, text: 'Título', format: 'h3' })
  const resetFromHeading = buildHeadingParagraphReset([persistedHeading], 'source', '')
  assert.equal(decodeTextBlock(resetFromHeading!)?.format, 'paragraph')
  assert.equal(decodeTextBlock(resetFromHeading!)?.text, '')

  const alreadyParagraph = encodeTextBlock({ id: 'source', kind: TEXT_BLOCK_KIND, text: '', format: 'paragraph' })
  const resetFromParagraph = buildHeadingParagraphReset([alreadyParagraph], 'source', '')
  assert.equal(decodeTextBlock(resetFromParagraph!)?.format, 'paragraph')
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

test('heading bridge keeps new heading focused and lets Backspace cross text blocks', () => {
  const bridge = readFileSync('src/features/editor/oanixTextBehaviorBridge.ts', 'utf8')
  assert.match(bridge, /focusInsertedHeading/)
  assert.match(bridge, /selectionStart === selectionEnd/)
  assert.match(bridge, /event\.preventDefault\(\)/)
  assert.match(bridge, /event\.key === 'Backspace'/)
  assert.match(bridge, /textareas\.indexOf\(target\)/)
  assert.match(bridge, /previous\.focus\(\{ preventScroll: true \}\)/)
  assert.match(bridge, /previous\.setSelectionRange\(end, end\)/)
})

test('heading bridge anchors remounts instead of trusting one scrollTop snapshot', () => {
  const bridge = readFileSync('src/features/editor/oanixTextBehaviorBridge.ts', 'utf8')
  assert.match(bridge, /pageScrollY:\s*window\.scrollY/)
  assert.match(bridge, /anchorBlockId/)
  assert.match(bridge, /anchorViewportTop/)
  assert.match(bridge, /window\.scrollTo\(state\.pageScrollX, state\.pageScrollY\)/)
  assert.match(bridge, /window\.setTimeout\(settle, 220\)/)
  assert.match(bridge, /buildHeadingEnterPlan\(blocks, blockId, selectionStart, selectionEnd, undefined, liveText, format\)/)
})

test('paragraph ruled test keeps text cadence locked to the ruling and removes focus box', () => {
  const css = readFileSync('src/features/editor/implementations/oanixNotesSheetMobileSafeArea.css', 'utf8')
  assert.match(css, /--oanix-ruled-step:\s*30px/)
  assert.match(css, /line-height:\s*var\(--oanix-ruled-step\)/)
  assert.match(css, /background-size:\s*100% var\(--oanix-ruled-step\)/)
  assert.match(css, /repeating-linear-gradient/)
  assert.match(css, /box-shadow:\s*none/)
  assert.match(css, /border-radius:\s*0/)
})
