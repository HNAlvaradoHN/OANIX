import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const contract = readFileSync('src/features/editor/editorSurfaceContract.ts', 'utf8')

test('editor surface contract keeps persistence and security outside visual templates', () => {
  assert.match(contract, /interface EditorSurfaceProps/)
  assert.match(contract, /onRequestSave: \(snapshot: EditorSurfaceSnapshot\) => Promise<boolean>/)
  assert.match(contract, /onRequestClose: \(snapshot: EditorSurfaceSnapshot \| null\) => Promise<boolean>/)
  assert.match(contract, /onActivity\?: \(\) => void/)

  assert.doesNotMatch(contract, /vaultRepository|encryptedRepository|contentCrypto|AutoSyncRuntime/)
  assert.doesNotMatch(contract, /indexedDB|localStorage|sessionStorage/)
})

test('editor capabilities are declarative and do not encode a specific sheet implementation', () => {
  assert.match(contract, /plainText: boolean/)
  assert.match(contract, /richBlocks: boolean/)
  assert.match(contract, /attachments: boolean/)
  assert.doesNotMatch(contract, /ruledSheet|Aurora|qwen|appquen/i)
})
