import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sheetCss = readFileSync(
  'src/features/editor/implementations/replicaV16SheetSurface.css',
  'utf8',
)
const textCss = readFileSync(
  'src/features/editor/implementations/qwenTextBlocks.css',
  'utf8',
)
const sheet = readFileSync(
  'src/features/editor/implementations/ReplicaV16SheetSurface.tsx',
  'utf8',
)

test('replica keeps floating controls viewport-fixed without keyboard viewport calculations', () => {
  assert.match(sheetCss, /\.oanix-replica-v16__floating\s*\{[\s\S]*position:\s*fixed/)
  assert.match(sheetCss, /top:\s*calc\(env\(safe-area-inset-top\) \+ 72px\)/)
  assert.doesNotMatch(sheet, /visualViewport|innerHeight|keyboard/i)
})

test('supported engines grow note textareas so the page owns vertical scrolling', () => {
  assert.match(sheetCss, /@supports \(field-sizing: content\)/)
  assert.match(sheetCss, /\.oanix-replica-v16__body[\s\S]*field-sizing:\s*content/)
  assert.match(sheetCss, /\.oanix-replica-v16__body[\s\S]*overflow-y:\s*hidden/)
  assert.match(textCss, /@supports \(field-sizing: content\)/)
  assert.match(textCss, /\.oanix-qwen-sheet__text-block > textarea[\s\S]*field-sizing:\s*content/)
  assert.match(textCss, /overflow-y:\s*hidden/)
})

test('fallback engines retain scrollable textareas instead of clipping long notes', () => {
  assert.match(sheetCss, /\.oanix-replica-v16__body\s*\{[\s\S]*overflow:\s*auto/)
  assert.match(textCss, /\.oanix-qwen-sheet__text-block > textarea\s*\{[\s\S]*overflow:\s*auto/)
})
