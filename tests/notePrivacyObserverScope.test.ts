import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const privacyRuntime = readFileSync('src/features/privacy/NotePrivacyRuntime.tsx', 'utf8')

test('note privacy observes only the unlocked notes workspace', () => {
  assert.match(privacyRuntime, /querySelector<HTMLElement>\('\.notes-shell'\)/)
  assert.match(privacyRuntime, /observer\.observe\(workspace,\s*\{[\s\S]*subtree:\s*true/)
  assert.doesNotMatch(privacyRuntime, /observer\.observe\(document\.body/)
  assert.doesNotMatch(privacyRuntime, /observer\.observe\(document\.documentElement/)
  assert.match(privacyRuntime, /window\.addEventListener\('input', bump, true\)/)
})
