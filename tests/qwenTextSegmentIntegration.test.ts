import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const surface = readFileSync('src/features/editor/implementations/QwenSheetSurface.tsx', 'utf8')
const richBlocks = readFileSync('src/features/editor/implementations/QwenRichBlocks.tsx', 'utf8')
const textCss = readFileSync('src/features/editor/implementations/qwenTextBlocks.css', 'utf8')

test('text segments are first-class ordered blocks without migrating legacy text', () => {
  assert.match(richBlocks, /TEXT_BLOCK_KIND/)
  assert.match(richBlocks, /encodeTextBlock/)
  assert.match(richBlocks, /decodeTextBlock/)
  assert.match(richBlocks, /insertBlock\('text', index\)/)
  assert.match(richBlocks, /session\.insert\(next, index\)/)
  assert.match(surface, /data-oanix-flow-segment="legacy-text"/)
  assert.doesNotMatch(surface, /TEXT_BLOCK_KIND|encodeTextBlock|decodeTextBlock/)
})

test('typing in an interleaved text segment avoids cloning React rich-flow state per key', () => {
  const queueStart = richBlocks.indexOf('function queueTextBlock')
  const queueEnd = richBlocks.indexOf('function removeBlock', queueStart)
  const queueBody = richBlocks.slice(queueStart, queueEnd)

  assert.match(queueBody, /session\.upsert\(next\)/)
  assert.match(queueBody, /onActivity\(\)/)
  assert.doesNotMatch(queueBody, /setBlocks/)
  assert.match(richBlocks, /defaultValue=\{block\.text\}/)
  assert.match(richBlocks, /onInput=\{\(event\) => queueTextBlock/)
})

test('text segments reuse the sheet composition guard and shared autosave timer', () => {
  assert.match(surface, /onCompositionStart=\{handleCompositionStart\}/)
  assert.match(surface, /onCompositionEnd=\{handleCompositionEnd\}/)
  assert.match(richBlocks, /onCompositionStart=\{onCompositionStart\}/)
  assert.match(richBlocks, /onCompositionEnd=\{onCompositionEnd\}/)
  assert.doesNotMatch(richBlocks, /setTimeout|setInterval/)
})

test('text segment styling stays lightweight and native', () => {
  assert.match(textCss, /\.oanix-qwen-sheet__text-block > textarea/)
  assert.doesNotMatch(textCss, /filter:|backdrop-filter:|animation:|transition:/)
})
