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

test('main Android builds fail closed when the stable signing secret is missing', () => {
  assert.match(workflow, /OANIX_DEBUG_KEYSTORE_BASE64 is required for main Android builds/)
  assert.match(workflow, /exit 1/)
  assert.doesNotMatch(workflow, /runner-generated debug key/)
})

test('main reports the produced debug APK signing certificate for verification', () => {
  assert.match(workflow, /Report debug APK signing certificate/)
  assert.match(workflow, /apksigner/)
  assert.match(workflow, /verify --print-certs/)
  assert.match(workflow, /app\/build\/outputs\/apk\/debug\/app-debug\.apk/)
})
