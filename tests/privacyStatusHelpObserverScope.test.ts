import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/features/privacy/PrivacyStatusHelp.tsx', 'utf8')

test('privacy status help never observes the whole document subtree', () => {
  assert.match(source, /portalObserver\.observe\(document\.body, \{ childList: true \}\)/)
  assert.doesNotMatch(source, /observe\(document\.body, \{[^}]*subtree:\s*true/s)
})

test('privacy status help observes action mutations only inside its own host', () => {
  assert.match(source, /actionsObserver\.observe\(nextHost, \{ childList: true, subtree: true, characterData: true \}\)/)
  assert.match(source, /portalObserver\.disconnect\(\)/)
  assert.match(source, /actionsObserver\?\.disconnect\(\)/)
})
