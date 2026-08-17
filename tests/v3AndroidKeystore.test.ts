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

test('Keystore foundation is registered natively and is not yet biometric-gated', () => {
  assert.match(mainActivitySource, /registerPlugin\(OanixKeystorePlugin\.class\)/)
  assert.match(pluginSource, /\.setUserAuthenticationRequired\(false\)/)
  assert.match(bridgeSource, /Capacitor\.getPlatform\(\) === 'android'/)
  assert.doesNotMatch(bridgeSource, /exportVaultKeyForRecovery/)
  assert.doesNotMatch(bridgeSource, /masterPassword/i)
})
