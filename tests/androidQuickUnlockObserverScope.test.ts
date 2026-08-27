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

test('device credential capability check runs only when the unlock form changes or window regains focus', () => {
  assert.match(credentialRuntime, /let currentForm: HTMLFormElement \| null = null/)
  assert.match(credentialRuntime, /const formChanged = form !== currentForm/)
  assert.match(credentialRuntime, /if \(!formChanged && !forceAvailabilityCheck\) return/)
  assert.match(credentialRuntime, /new MutationObserver\(\(\) => refresh\(\)\)/)
  assert.match(credentialRuntime, /const handleFocus = \(\) => refresh\(true\)/)
})
