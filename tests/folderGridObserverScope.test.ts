import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')

test('folder grid filters unrelated workspace mutations before refreshing targets', () => {
  assert.match(runtime, /querySelector<HTMLElement>\('\.notes-shell'\)/)
  assert.match(runtime, /mutationTouchesFolderGridTargets/)
  assert.match(runtime, /records\.some\(mutationTouchesFolderGridTargets\)/)
  assert.match(runtime, /notes-sidebar/)
  assert.match(runtime, /notes-tabs-shell/)
  assert.match(runtime, /notes-header/)
  assert.match(runtime, /notes-search/)
  assert.match(runtime, /notes-tab/)
  assert.match(runtime, /attributeFilter:\s*\['aria-current',\s*'class'\]/)
  assert.doesNotMatch(runtime, /new MutationObserver\(refreshTargets\)/)
  assert.doesNotMatch(runtime, /observer\.observe\(document\.body/)
})
