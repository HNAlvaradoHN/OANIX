import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')

test('folder grid observes only the notes workspace, never the whole document body', () => {
  assert.match(runtime, /querySelector<HTMLElement>\('\.notes-shell'\)/)
  assert.match(runtime, /observer\.observe\(workspace,\s*\{[\s\S]*subtree:\s*true/)
  assert.doesNotMatch(runtime, /observer\.observe\(document\.body/)
  assert.doesNotMatch(runtime, /observe\(document\.body,\s*\{[\s\S]*subtree:\s*true/)
})
