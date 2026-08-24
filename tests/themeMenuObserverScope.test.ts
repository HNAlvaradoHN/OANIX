import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/features/personalization/ThemeMenu.tsx', 'utf8')

test('ThemeMenu observes only the notes workspace for menu mounting', () => {
  assert.match(source, /document\.querySelector<HTMLElement>\('\.notes-shell'\)/)
  assert.match(source, /workspace\?\.querySelector<HTMLElement>\('\.workspace-menu\[role="menu"\]'\)/)
  assert.match(source, /observer\.observe\(workspace, \{ childList: true, subtree: true \}\)/)
  assert.doesNotMatch(source, /observer\.observe\(document\.body/)
})
