import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const biometricRuntime = readFileSync('src/platform/android/AndroidBiometricRetryRuntime.tsx', 'utf8')

test('integrated Android quick unlock observes only the React app root', () => {
  assert.match(biometricRuntime, /document\.getElementById\('root'\)/)
  assert.match(biometricRuntime, /observer\.observe\(appRoot, \{ childList: true, subtree: true \}\)/)
  assert.doesNotMatch(biometricRuntime, /observer\.observe\(document\.body/)
  assert.doesNotMatch(biometricRuntime, /observer\.observe\(document\.documentElement/)
})

test('integrated Android quick unlock keeps both biometric and device credential capabilities', () => {
  assert.match(biometricRuntime, /canUseAndroidBiometricUnlock\(\)/)
  assert.match(biometricRuntime, /canUseAndroidDeviceCredentialUnlock\(\)/)
  assert.match(biometricRuntime, /unlockLocalVaultWithBiometrics\(\)/)
  assert.match(biometricRuntime, /unlockLocalVaultWithDeviceCredential\(\)/)
})
