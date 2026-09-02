import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sourceUrl = new URL('../src/features/editor/implementations/QwenRichBlocks.tsx', import.meta.url)

test('new rich blocks focus their primary editing field without persistence or timers', async () => {
  const source = await readFile(sourceUrl, 'utf8')

  assert.match(source, /pendingFocusIdRef/)
  assert.match(source, /data-oanix-primary-input="true"/)
  assert.match(source, /target\.focus\(\{ preventScroll: true \}\)/)
  assert.match(source, /target\.scrollIntoView\(\{ block: 'nearest' \}\)/)
  assert.match(source, /pendingFocusIdRef\.current = nextBlock\.id/)
  assert.match(source, /data-oanix-block-id=\{block\.id\}/)

  assert.doesNotMatch(source, /setTimeout\s*\(/)
  assert.doesNotMatch(source, /setInterval\s*\(/)
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/)
  assert.doesNotMatch(source, /\bfetch\s*\(/)
})
