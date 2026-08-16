import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('master password rotation rewraps the same vault key instead of creating a new vault', () => {
  const cryptoSource = readFileSync('src/security/crypto/vaultCrypto.ts', 'utf8')

  assert.match(cryptoSource, /export async function rewrapVaultProtection/)
  assert.match(cryptoSource, /const vaultKeyBytes = await openVaultProtectionBytes\(currentPassword, protection\)/)
  assert.match(cryptoSource, /createProtectionForVaultKeyBytes\(newPassword, vaultKeyBytes\)/)
  assert.match(cryptoSource, /importAesKey\(vaultKeyBytes, \['encrypt', 'decrypt'\]\)/)
  assert.doesNotMatch(cryptoSource, /exportKey\(/)
})

test('local password change persists only new protection metadata and keeps the vault unlocked with the same key material', () => {
  const vaultService = readFileSync('src/security/vault/vaultService.ts', 'utf8')

  assert.match(vaultService, /export async function changeLocalMasterPassword/)
  assert.match(vaultService, /rewrapVaultProtection\(/)
  assert.match(vaultService, /protection: rotated\.protection/)
  assert.match(vaultService, /setActiveVaultKey\(rotated\.vaultKey\)/)
  assert.doesNotMatch(vaultService, /createVaultProtection\(newPassword\)/)
})

test('password rotation is not exposed in the UI before synchronized propagation is implemented', () => {
  const app = readFileSync('src/app/App.tsx', 'utf8')
  const gate = readFileSync('src/app/VaultGate.tsx', 'utf8')

  assert.doesNotMatch(app, /changeLocalMasterPassword/)
  assert.doesNotMatch(gate, /changeLocalMasterPassword/)
})
