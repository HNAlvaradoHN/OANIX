import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/features/personalization/NotebookPaperPreference.tsx', 'utf8')

test('NotebookPaperPreference watches only direct body children for portal mounting', () => {
  assert.match(source, /observer\.observe\(document\.body, \{ childList: true \}\)/)
  assert.doesNotMatch(source, /subtree:\s*true/)
  assert.doesNotMatch(source, /attributes:\s*true/)
})
