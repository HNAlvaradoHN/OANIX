import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/privacy/NoteBulkPrivacyRuntime.tsx', 'utf8')

test('bulk privacy watches direct note-list structure instead of the whole workspace', () => {
  assert.match(runtime, /querySelector<HTMLElement>\('\.notes-list'\)/)
  assert.match(runtime, /observer\.observe\(noteList,\s*\{\s*childList:\s*true\s*\}\)/s)
  assert.doesNotMatch(runtime, /observer\.observe\(workspace/)
  assert.doesNotMatch(runtime, /subtree:\s*true/)
})
