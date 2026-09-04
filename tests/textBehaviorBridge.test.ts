import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildHeadingEnterPlan } from '../src/features/editor/oanixHeadingEnterPlan.ts'
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

test('behavior bridge preserves scroll and ruled H2/H3 cadence is explicit', () => {
  const bridge = readFileSync('src/features/editor/oanixTextBehaviorBridge.ts', 'utf8')
  const css = readFileSync('src/features/editor/implementations/oanixNotesSheetMobileSafeArea.css', 'utf8')
  assert.match(bridge, /scrollTop/)
  assert.match(bridge, /pointerdown/)
  assert.match(bridge, /format !== 'h2' && format !== 'h3'/)
  assert.match(bridge, /event\.preventDefault\(\)/)
  assert.match(css, /--oanix-h2-ruled-step: 42px/)
  assert.match(css, /--oanix-h3-ruled-step: 36px/)
  assert.match(css, /line-height: var\(--oanix-h2-ruled-step\)/)
  assert.match(css, /line-height: var\(--oanix-h3-ruled-step\)/)
})
