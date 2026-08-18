import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtimeSource = readFileSync('src/platform/android/AndroidBiometricRetryRuntime.tsx', 'utf8')
const vaultSource = readFileSync('src/security/vault/vaultService.ts', 'utf8')
const appSource = readFileSync('src/app/App.tsx', 'utf8')

test('locked Android vault exposes one device-security retry without requiring the master password', () => {
  assert.match(vaultSource, /export async function canUseAndroidBiometricUnlock/)
  assert.match(vaultSource, /export async function unlockLocalVaultWithBiometrics/)
  assert.match(vaultSource, /await tryAndroidBiometricUnlock\(metadata\)/)
  assert.doesNotMatch(runtimeSource, /masterPassword|password\s*:/)
})

test('device-security retry appears beside local or synchronized master-password forms when available', () => {
  assert.match(runtimeSource, /#master-password, #cloud-master-password/)
  assert.match(runtimeSource, /canUseAndroidBiometricUnlock\(\)/)
  assert.match(runtimeSource, /Usar PIN, patrón o huella/)
  assert.match(runtimeSource, /<svg/)
})

test('successful retry verifies encrypted storage and remounts VaultGate', () => {
  assert.match(runtimeSource, /unlockLocalVaultWithBiometrics\(\)/)
  assert.match(runtimeSource, /verifyLocalEncryption\(\)/)
  assert.match(runtimeSource, /onUnlocked\(\)/)
  assert.match(appSource, /<AndroidBiometricRetryRuntime/)
  assert.match(appSource, /setVaultGateRevision\(\(value\) => value \+ 1\)/)
})
