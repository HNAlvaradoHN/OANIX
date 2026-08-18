import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workflow = readFileSync('.github/workflows/android.yml', 'utf8')
const buildGradle = readFileSync('android/app/build.gradle', 'utf8')
const gitignore = readFileSync('.gitignore', 'utf8')

test('stable debug signing is restored only for main push builds', () => {
  assert.match(workflow, /Restore stable debug signing key on main/)
  assert.match(workflow, /if: github\.event_name == 'push'/)
  assert.match(workflow, /secrets\.OANIX_DEBUG_KEYSTORE_BASE64/)
  assert.match(workflow, /android\/app\/oanix-stable-debug\.keystore/)
})

test('Gradle explicitly uses the OANIX stable debug keystore when present', () => {
  assert.match(buildGradle, /oanix-stable-debug\.keystore/)
  assert.match(buildGradle, /storeFile oanixStableDebugKeystore/)
  assert.match(buildGradle, /storePassword 'android'/)
  assert.match(buildGradle, /keyAlias 'androiddebugkey'/)
  assert.match(buildGradle, /keyPassword 'android'/)
  assert.match(buildGradle, /signingConfig signingConfigs\.debug/)
})

test('pull request validation remains available without exposing committed private key material', () => {
  assert.match(workflow, /pull_request:/)
  assert.match(workflow, /branches: \[main\]/)
  assert.doesNotMatch(workflow, /BEGIN (?:RSA )?PRIVATE KEY|MII[A-Za-z0-9+/]{80,}/)
  assert.match(gitignore, /android\/app\/oanix-stable-debug\.keystore/)
})

test('main Android builds fail closed when the stable signing secret is missing', () => {
  assert.match(workflow, /OANIX_DEBUG_KEYSTORE_BASE64 is required for main Android builds/)
  assert.match(workflow, /exit 1/)
})

test('main verifies the exact expected OANIX debug signing certificate', () => {
  assert.match(workflow, /Verify stable debug APK signing certificate/)
  assert.match(workflow, /verify --print-certs/)
  assert.match(workflow, /EXPECTED_SHA256="ad4aae0c14ee8a78617fed361baf6f4fb9236650f5cc6e724cfbe992ff5c394a"/)
  assert.match(workflow, /Unexpected APK signing certificate/)
  assert.match(workflow, /Stable OANIX debug signing certificate verified/)
})

test('main publishes an observable commit status only after stable signing verification', () => {
  assert.match(workflow, /statuses: write/)
  assert.match(workflow, /Publish stable signing verification status/)
  assert.match(workflow, /repos\.createCommitStatus/)
  assert.match(workflow, /context: 'oanix\/stable-debug-signing'/)
  assert.match(workflow, /state: 'success'/)
  assert.match(workflow, /Stable OANIX debug signing certificate verified/)
})

test('stable keystore material is removed from the runner workspace after signing', () => {
  assert.match(workflow, /Remove stable signing material from workspace/)
  assert.match(workflow, /rm -f .*oanix-stable-debug\.keystore/)
})
