import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtimeSource = readFileSync('src/platform/android/AndroidBiometricRetryRuntime.tsx', 'utf8')
const vaultSource = readFileSync('src/security/vault/vaultService.ts', 'utf8')
const appSource = readFileSync('src/app/App.tsx', 'utf8')

test('locked Android vault exposes device-security unlock without requiring the master password', () => {
  assert.match(vaultSource, /export async function canUseAndroidBiometricUnlock/)
  assert.match(vaultSource, /export async function unlockLocalVaultWithBiometrics/)
  assert.match(vaultSource, /await tryAndroidBiometricUnlock\(metadata\)/)
  assert.doesNotMatch(runtimeSource, /masterPassword|password\s*:/)
})

test('device security exposes PIN-pattern-password above fingerprint on local or synchronized forms', () => {
  assert.match(runtimeSource, /#master-password, #cloud-master-password/)
  assert.match(runtimeSource, /canUseAndroidBiometricUnlock\(\)/)
  assert.match(runtimeSource, /canUseAndroidDeviceCredentialUnlock\(\)/)
  assert.match(runtimeSource, /PIN, patrón o contraseña/)
  assert.match(runtimeSource, /Usar huella/)
  assert.ok(runtimeSource.indexOf('PIN, patrón o contraseña') < runtimeSource.indexOf('Usar huella'))
  assert.match(runtimeSource, /unlockLocalVaultWithDeviceCredential\(\)/)
  assert.match(runtimeSource, /unlockLocalVaultWithBiometrics\(\)/)
  assert.match(runtimeSource, /<svg/)
})

test('both device-security methods verify encrypted storage and remount VaultGate', () => {
  assert.match(runtimeSource, /verifyUnlockedDeviceVault\(\)/)
  assert.match(runtimeSource, /verifyLocalEncryption\(\)/)
  assert.match(runtimeSource, /onUnlocked\(\)/)
  assert.match(appSource, /<AndroidBiometricRetryRuntime/)
  assert.match(appSource, /setVaultGateRevision\(\(value\) => value \+ 1\)/)
})
