import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/privacy/PrivateBoxListHint.tsx', 'utf8')

test('private box list hint observes only the notes workspace', () => {
  assert.match(runtime, /const workspace = document\.querySelector<HTMLElement>\('\.notes-shell'\)/)
  assert.match(runtime, /const observedWorkspace = workspace/)
  assert.match(runtime, /observer\.observe\(observedWorkspace, \{/)
  assert.doesNotMatch(runtime, /observer\.observe\(document\.body/)
})

test('private box list hint queries list and search state inside the workspace', () => {
  assert.match(runtime, /observedWorkspace\.querySelector<HTMLElement>\('\.notes-list'\)/)
  assert.match(runtime, /observedWorkspace\.querySelector\('\.notes-search'\)/)
})
