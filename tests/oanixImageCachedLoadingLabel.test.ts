import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/features/editor/implementations/OanixMixedDocumentBody.tsx', 'utf8')

test('cached image loads do not immediately flash the decrypting label', () => {
  assert.match(source, /const IMAGE_DECRYPTING_LABEL_DELAY_MS = 120/)
  assert.match(source, /setLoading\(true\)[\s\S]*setShowDecryptingLabel\(false\)[\s\S]*window\.setTimeout/)
  assert.match(source, /setShowDecryptingLabel\(true\)[\s\S]*IMAGE_DECRYPTING_LABEL_DELAY_MS/)
  assert.match(source, /window\.clearTimeout\(loadingLabelTimer\)/)
  assert.match(source, /loading \? \(showDecryptingLabel \? 'Descifrando imagen…' : '\\\\u00a0'\)/)
})
