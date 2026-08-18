import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workflow = readFileSync('.github/workflows/android.yml', 'utf8')

test('stable debug signing is restored only for main push builds', () => {
  assert.match(workflow, /Restore stable debug signing key on main/)
  assert.match(workflow, /if: github\.event_name == 'push'/)
  assert.match(workflow, /secrets\.OANIX_DEBUG_KEYSTORE_BASE64/)
  assert.match(workflow, /\$HOME\/\.android\/debug\.keystore/)
})

test('pull request validation remains available without exposing a committed private key', () => {
  assert.match(workflow, /pull_request:/)
  assert.match(workflow, /branches: \[main\]/)
  assert.doesNotMatch(workflow, /BEGIN (?:RSA )?PRIVATE KEY|MII[A-Za-z0-9+/]{80,}/)
  assert.doesNotMatch(workflow, /\.jks|\.keystore\.base64/)
})

test('missing signing secret falls back to the runner debug key instead of failing CI', () => {
  assert.match(workflow, /Stable debug signing secret is not configured/)
  assert.match(workflow, /exit 0/)
  assert.match(workflow, /\.\/gradlew assembleDebug bundleRelease/)
})
