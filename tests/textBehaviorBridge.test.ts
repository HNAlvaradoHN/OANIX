import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildHeadingEnterPlan, buildHeadingParagraphReset } from '../src/features/editor/oanixHeadingEnterPlan.ts'
import { decodeTextBlock, encodeTextBlock, TEXT_BLOCK_KIND } from '../src/features/editor/textBlockCodec.ts'

test('Enter after H2 keeps heading and creates paragraph immediately after', () => {
  const source = encodeTextBlock({ id: 'h2-1', kind: TEXT_BLOCK_KIND, text: 'Título', format: 'h2' })
  const tail = encodeTextBlock({ id: 'tail', kind: TEXT_BLOCK_KIND, text: 'Después', format: 'paragraph' })
  const plan = buildHeadingEnterPlan([source, tail], 'h2-1', 6, 6, () => 'paragraph-1')
  assert.ok(plan)
  assert.deepEqual(plan.order, ['h2-1', 'paragraph-1', 'tail'])
  assert.equal(decodeTextBlock(plan.heading)?.format, 'h2')
  assert.equal(decodeTextBlock(plan.paragraph)?.format, 'paragraph')
  assert.equal(decodeTextBlock(plan.paragraph)?.text, '')
})

test('Enter in the middle of H3 moves remaining text into the new paragraph', () => {
  const source = encodeTextBlock({ id: 'h3-1', kind: TEXT_BLOCK_KIND, text: 'Uno dos', format: 'h3' })
  const plan = buildHeadingEnterPlan([source], 'h3-1', 3, 4, () => 'paragraph-2')
  assert.ok(plan)
  assert.equal(decodeTextBlock(plan.heading)?.text, 'Uno')
  assert.equal(decodeTextBlock(plan.heading)?.format, 'h3')
  assert.equal(decodeTextBlock(plan.paragraph)?.text, 'dos')
  assert.equal(decodeTextBlock(plan.paragraph)?.format, 'paragraph')
})

test('Enter uses the live textarea value instead of stale persisted heading text', () => {
  const persisted = encodeTextBlock({ id: 'h2-live', kind: TEXT_BLOCK_KIND, text: 'Viejo', format: 'h2' })
  const plan = buildHeadingEnterPlan([persisted], 'h2-live', 12, 12, () => 'paragraph-live', 'Título nuevo')
  assert.ok(plan)
  assert.equal(decodeTextBlock(plan.heading)?.text, 'Título nuevo')
  assert.equal(decodeTextBlock(plan.paragraph)?.text, '')
})

test('empty H2 or H3 resets the same block to paragraph instead of leaving a heading ruling', () => {
  for (const format of ['h2', 'h3'] as const) {
    const source = encodeTextBlock({ id: `heading-${format}`, kind: TEXT_BLOCK_KIND, text: 'Temporal', format })
    const reset = buildHeadingParagraphReset([source], `heading-${format}`, '')
    assert.ok(reset)
    assert.equal(reset.id, `heading-${format}`)
    assert.equal(decodeTextBlock(reset)?.format, 'paragraph')
    assert.equal(decodeTextBlock(reset)?.text, '')
  }
})

test('behavior bridge preserves scroll, makes paragraph priority immediate and keeps heading continuation compact', () => {
  const bridge = readFileSync('src/features/editor/oanixTextBehaviorBridge.ts', 'utf8')
  const css = readFileSync('src/features/editor/implementations/oanixNotesSheetMobileSafeArea.css', 'utf8')
  assert.match(bridge, /scrollTop/)
  assert.match(bridge, /anchorBlockId/)
  assert.match(bridge, /pageScrollY/)
  assert.match(bridge, /pointerdown/)
  assert.match(bridge, /target\.value\.length !== 0/)
  assert.match(bridge, /target\.dataset\.oanixTextFormat = 'paragraph'/)
  assert.match(bridge, /const format = target\.dataset\.oanixTextFormat/)
  assert.match(bridge, /buildHeadingEnterPlan\(blocks, blockId, selectionStart, selectionEnd, undefined, liveText, format\)/)
  assert.match(bridge, /normalizeRuledHeight/)
  assert.match(css, /--oanix-h2-ruled-step: 42px/)
  assert.match(css, /--oanix-h3-ruled-step: 36px/)
  assert.match(css, /min-height: var\(--oanix-ruled-step\)/)
  assert.match(css, /margin-top: calc\(-1 \* var\(--oanix-text-block-gap\)\)/)
  assert.match(css, /line-height: var\(--oanix-h2-ruled-step\)/)
  assert.match(css, /line-height: var\(--oanix-h3-ruled-step\)/)
})