import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const codec = readFileSync('src/features/editor/simpleRichBlockCodec.ts', 'utf8')
const richBlocks = readFileSync('src/features/editor/implementations/QwenRichBlocks.tsx', 'utf8')

test('replica simple block codecs stay storage-agnostic', () => {
  assert.match(codec, /ENTRY_BLOCK_KIND = 'entry-v1'/)
  assert.match(codec, /CONTACT_BLOCK_KIND = 'contact-v1'/)
  assert.match(codec, /SEPARATOR_BLOCK_KIND = 'separator-v1'/)
  assert.doesNotMatch(codec, /indexedDB|localStorage|sessionStorage|fetch\(|XMLHttpRequest|rebuildService|contentCrypto/)
})

test('rich block flow exposes entry contact and separator through the generic session', () => {
  assert.match(richBlocks, /QwenInsertBlockKind =[^\n]*'entry'[^\n]*'contact'[^\n]*'separator'/)
  assert.match(richBlocks, /session\.insert\(nextBlock, index\)/)
  assert.match(richBlocks, /decodeEntryBlock\(rawBlock\)/)
  assert.match(richBlocks, /decodeContactBlock\(rawBlock\)/)
  assert.match(richBlocks, /decodeSeparatorBlock\(rawBlock\)/)
  assert.doesNotMatch(richBlocks, /indexedDB|localStorage|sessionStorage|saveRebuildBlocks|readRebuildBlocks/)
})
