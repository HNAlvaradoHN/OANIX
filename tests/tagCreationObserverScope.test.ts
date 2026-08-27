import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/tags/TagCreationRuntime.tsx', 'utf8')

test('tag creation observes only the notes workspace and filters unrelated subtree churn', () => {
  assert.match(runtime, /document\.querySelector<HTMLElement>\('\.notes-shell'\)/)
  assert.match(runtime, /observer\.observe\(workspace, \{ childList: true, subtree: true \}\)/)
  assert.match(runtime, /function mutationTouchesTagSurface\(record: MutationRecord\)/)
  assert.match(runtime, /TAG_DECORATION_SELECTOR/)
  assert.match(runtime, /records\.some\(mutationTouchesTagSurface\)/)
  assert.doesNotMatch(runtime, /new MutationObserver\(scheduleDecorate\)/)
  assert.doesNotMatch(runtime, /observer\.observe\(document\.body/)
})

test('tag creation keeps local data events as the storage-driven refresh path', () => {
  assert.match(runtime, /oanix:local-data-changed/)
  assert.match(runtime, /recordType !== 'tag'/)
  assert.match(runtime, /recordType !== 'tag-order'/)
})
