import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('email recovery fallback redirects to the deployed OANIX base path', () => {
  const source = readFileSync('src/features/recovery/recoveryService.ts', 'utf8')

  assert.match(source, /new URL\(import\.meta\.env\.BASE_URL, window\.location\.origin\)/)
  assert.match(source, /emailRedirectTo: getRecoveryRedirectUrl\(\)/)
  assert.match(source, /shouldCreateUser: false/)
})
