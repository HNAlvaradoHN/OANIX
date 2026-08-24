import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/folders/FolderAppearanceRuntime.tsx', 'utf8')

test('folder appearance runtime scopes DOM observation to the folder grid and direct body children', () => {
  assert.match(runtime, /gridObserver\.observe\(observedGrid, \{ childList: true, subtree: true \}\)/)
  assert.match(runtime, /bodyObserver\.observe\(document\.body, \{ childList: true \}\)/)
  assert.doesNotMatch(runtime, /observe\(document\.body, \{ childList: true, subtree: true \}\)/)
})

test('folder appearance runtime disconnects both scoped observers', () => {
  assert.match(runtime, /bodyObserver\.disconnect\(\)/)
  assert.match(runtime, /gridObserver\?\.disconnect\(\)/)
})
