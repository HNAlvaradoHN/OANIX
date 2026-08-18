import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  AUTO_LOCK_OPTIONS,
  DEFAULT_AUTO_LOCK_MINUTES,
  autoLockDelayMs,
  normalizeAutoLockMinutes,
  shouldAutoLockAfterBackground,
} from '../src/security/session/autoLockPolicy.ts'

test('background auto-lock defaults to five minutes with explicit safe choices', () => {
  assert.equal(DEFAULT_AUTO_LOCK_MINUTES, 5)
  assert.deepEqual(AUTO_LOCK_OPTIONS.map((option) => option.minutes), [1, 5, 15, 60])
  assert.equal(normalizeAutoLockMinutes('15'), 15)
  assert.equal(normalizeAutoLockMinutes('999'), 5)
  assert.equal(autoLockDelayMs(5), 5 * 60 * 1000)
})

test('returning before the grace period stays unlocked and the boundary locks', () => {
  const hiddenAt = 1_000_000
  assert.equal(shouldAutoLockAfterBackground(hiddenAt, hiddenAt + autoLockDelayMs(5) - 1, 5), false)
  assert.equal(shouldAutoLockAfterBackground(hiddenAt, hiddenAt + autoLockDelayMs(5), 5), true)
  assert.equal(shouldAutoLockAfterBackground(null, hiddenAt + autoLockDelayMs(5), 5), false)
})

test('runtime counts background time without persisting a vault unlock capability', () => {
  const app = readFileSync('src/app/App.tsx', 'utf8')
  const policy = readFileSync('src/security/session/autoLockPolicy.ts', 'utf8')
  const session = readFileSync('src/security/vault/vaultSession.ts', 'utf8')

  assert.match(app, /backgroundedAt\.current = Date\.now\(\)/)
  assert.match(app, /shouldAutoLockAfterBackground/)
  assert.match(app, /isAndroidSystemInteractionActive\(\)/)
  assert.match(app, /lockLocalVault\(\)/)
  assert.match(policy, /oanix:auto-lock-minutes:v1/)
  assert.doesNotMatch(policy, /password|vaultKey|CryptoKey|encrypted_records/)
  assert.match(session, /let activeVaultKey: CryptoKey \| null = null/)
  assert.doesNotMatch(session, /localStorage|sessionStorage|indexedDB/)
})

test('personalization exposes the four auto-lock choices and keeps manual lock immediate', () => {
  const menu = readFileSync('src/features/personalization/ThemeMenu.tsx', 'utf8')

  assert.match(menu, /Seguridad/)
  assert.match(menu, /Bloqueo automático al dejar OANIX en segundo plano/)
  assert.match(menu, /AUTO_LOCK_OPTIONS\.map/)
  assert.match(menu, /El botón 🔒 siempre bloquea de inmediato/)
})
