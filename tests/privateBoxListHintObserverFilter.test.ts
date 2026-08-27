import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/privacy/PrivateBoxListHint.tsx', 'utf8')

test('private box hint ignores unrelated workspace mutation noise', () => {
  assert.match(runtime, /function mutationCanAffectHint\(record: MutationRecord\)/)
  assert.match(runtime, /records\.some\(mutationCanAffectHint\)/)
  assert.match(runtime, /\.matches\('\.notes-list, \.notes-search, \.note-row\[data-reorder-note-id\]'\)/)
  assert.match(runtime, /\.querySelector\('\.notes-list, \.notes-search, \.note-row\[data-reorder-note-id\]'\)/)
  assert.doesNotMatch(runtime, /new MutationObserver\(scheduleInspect\)/)
})
