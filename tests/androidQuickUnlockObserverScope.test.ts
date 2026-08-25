import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const credentialRuntime = readFileSync('src/platform/android/AndroidDeviceCredentialRetryRuntime.tsx', 'utf8')
const biometricRuntime = readFileSync('src/platform/android/AndroidBiometricRetryRuntime.tsx', 'utf8')

for (const [name, runtime] of [
  ['device credential retry', credentialRuntime],
  ['biometric retry', biometricRuntime],
] as const) {
  test(`${name} observes only the React app root`, () => {
    assert.match(runtime, /document\.getElementById\('root'\)/)
    assert.match(runtime, /observer\.observe\(appRoot, \{ childList: true, subtree: true \}\)/)
    assert.doesNotMatch(runtime, /observer\.observe\(document\.body/)
    assert.doesNotMatch(runtime, /observer\.observe\(document\.documentElement/)
  })
}
