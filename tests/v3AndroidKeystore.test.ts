import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const pluginSource = readFileSync(
  'android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixKeystorePlugin.java',
  'utf8',
)
const mainActivitySource = readFileSync(
  'android/app/src/main/java/io/github/hnalvaradohn/oanix/MainActivity.java',
  'utf8',
)
const bridgeSource = readFileSync('src/platform/android/keystore.ts', 'utf8')
const diagnosticSource = readFileSync('src/platform/android/AndroidKeystoreDiagnosticRuntime.tsx', 'utf8')
const appSource = readFileSync('src/app/App.tsx', 'utf8')

test('Android device sealing key is generated inside AndroidKeyStore as AES-256-GCM', () => {
  assert.match(pluginSource, /KeyGenerator\.getInstance\(KeyProperties\.KEY_ALGORITHM_AES, PROVIDER\)/)
  assert.match(pluginSource, /\.setKeySize\(KEY_SIZE_BITS\)/)
  assert.match(pluginSource, /private static final int KEY_SIZE_BITS = 256/)
  assert.match(pluginSource, /\.setBlockModes\(KeyProperties\.BLOCK_MODE_GCM\)/)
  assert.match(pluginSource, /\.setEncryptionPaddings\(KeyProperties\.ENCRYPTION_PADDING_NONE\)/)
  assert.match(pluginSource, /\.setRandomizedEncryptionRequired\(true\)/)
  assert.doesNotMatch(pluginSource, /getEncoded\(\)/)
})

test('Keystore envelopes bind ciphertext to an explicit purpose through GCM AAD', () => {
  const aadUses = pluginSource.match(/updateAAD\(purpose\.getBytes\(StandardCharsets\.UTF_8\)\)/g) ?? []
  assert.equal(aadUses.length, 2)
  assert.match(pluginSource, /MAX_PLAINTEXT_BYTES = 4096/)
})

test('generic device sealing remains separate from the user-authenticated biometric vault key', () => {
  assert.match(mainActivitySource, /registerPlugin\(OanixKeystorePlugin\.class\)/)
  assert.match(mainActivitySource, /registerPlugin\(OanixBiometricPlugin\.class\)/)
  assert.match(pluginSource, /\.setUserAuthenticationRequired\(false\)/)
  assert.match(bridgeSource, /Capacitor\.getPlatform\(\) === 'android'/)
  assert.doesNotMatch(bridgeSource, /exportVaultKeyForRecovery/)
  assert.doesNotMatch(bridgeSource, /masterPassword/i)
})

test('Android exposes an explicit in-device seal/open self-test from the unlocked workspace', () => {
  assert.match(appSource, /AndroidKeystoreDiagnosticRuntime/)
  assert.match(diagnosticSource, /Verificar protección Android/)
  assert.match(diagnosticSource, /ensureAndroidDeviceKey\(\)/)
  assert.match(diagnosticSource, /sealWithAndroidKeystore\(challenge, SELF_TEST_PURPOSE\)/)
  assert.match(diagnosticSource, /openWithAndroidKeystore\(envelope, SELF_TEST_PURPOSE\)/)
  assert.match(diagnosticSource, /opened !== challenge/)
  assert.match(diagnosticSource, /getAndroidKeystoreStatus\(\)/)
})

test('Keystore self-test verifies AAD rejection and never persists its temporary challenge', () => {
  assert.match(diagnosticSource, /crypto\.randomUUID|crypto\?\.randomUUID/)
  assert.match(diagnosticSource, /crypto\?\.getRandomValues|crypto\.getRandomValues/)
  assert.match(diagnosticSource, /openWithAndroidKeystore\(envelope, WRONG_PURPOSE\)/)
  assert.match(diagnosticSource, /wrongPurposeRejected/)
  assert.doesNotMatch(diagnosticSource, /localStorage|sessionStorage|indexedDB|fetch\(|supabase|writeEncryptedRecord/)
  assert.doesNotMatch(diagnosticSource, /deleteAndroidDeviceKey/)
})
