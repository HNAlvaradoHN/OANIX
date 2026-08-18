import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const pluginSource = readFileSync(
  'android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixBiometricPlugin.java',
  'utf8',
)
const mainActivitySource = readFileSync(
  'android/app/src/main/java/io/github/hnalvaradohn/oanix/MainActivity.java',
  'utf8',
)
const manifestSource = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8')
const variablesSource = readFileSync('android/variables.gradle', 'utf8')
const gradleSource = readFileSync('android/app/build.gradle', 'utf8')
const vaultServiceSource = readFileSync('src/security/vault/vaultService.ts', 'utf8')
const biometricBridgeSource = readFileSync('src/platform/android/biometricVault.ts', 'utf8')
const trustedKeySource = readFileSync('src/security/crypto/trustedDeviceVaultKey.ts', 'utf8')

test('Android biometric unlock uses the stable AndroidX biometric dependency and system permission', () => {
  assert.match(variablesSource, /androidxBiometricVersion = '1\.1\.0'/)
  assert.match(gradleSource, /androidx\.biometric:biometric:\$androidxBiometricVersion/)
  assert.match(manifestSource, /android\.permission\.USE_BIOMETRIC/)
  assert.match(mainActivitySource, /registerPlugin\(OanixBiometricPlugin\.class\)/)
})

test('biometric vault key is Keystore-gated by strong biometric or device credential', () => {
  assert.match(pluginSource, /Build\.VERSION\.SDK_INT >= MIN_BIOMETRIC_API/)
  assert.match(pluginSource, /MIN_BIOMETRIC_API = Build\.VERSION_CODES\.R/)
  assert.match(pluginSource, /BiometricManager\.Authenticators\.BIOMETRIC_STRONG/)
  assert.match(pluginSource, /BiometricManager\.Authenticators\.DEVICE_CREDENTIAL/)
  assert.doesNotMatch(pluginSource, /BIOMETRIC_WEAK/)
  assert.match(pluginSource, /\.setUserAuthenticationRequired\(true\)/)
  assert.match(pluginSource, /AUTH_VALIDITY_SECONDS = 5/)
  assert.match(pluginSource, /\.setUserAuthenticationParameters\(\s*AUTH_VALIDITY_SECONDS,/)
  assert.match(pluginSource, /KeyProperties\.AUTH_BIOMETRIC_STRONG \| KeyProperties\.AUTH_DEVICE_CREDENTIAL/)
  assert.doesNotMatch(pluginSource, /new BiometricPrompt\.CryptoObject\(cipher\)/)
})

test('native biometric persistence stores and verifies only an authenticated ciphertext envelope bound to one vault', () => {
  assert.match(pluginSource, /ENVELOPE_VERSION = 2/)
  assert.match(pluginSource, /oanix\.biometric-vault\.v2/)
  assert.match(pluginSource, /VAULT_KEY_BYTES = 32/)
  assert.match(pluginSource, /AAD_PREFIX \+ binding/)
  assert.match(pluginSource, /putString\(PREF_IV,/)
  assert.match(pluginSource, /putString\(PREF_CIPHERTEXT,/)
  assert.match(pluginSource, /putString\(PREF_BINDING, binding\)/)
  assert.match(pluginSource, /\.commit\(\)/)
  assert.match(pluginSource, /!persisted \|\| !hasStoredEnvelope\(\) \|\| !keyStore\(\)\.containsAlias\(KEY_ALIAS\)/)
  assert.doesNotMatch(pluginSource, /putString\([^\n]*vaultKey/i)
  assert.doesNotMatch(pluginSource, /getEncoded\(\)/)
})

test('Android startup can unlock with the device-authorized vault key while password remains the fallback', () => {
  assert.match(vaultServiceSource, /tryAndroidBiometricUnlock\(existingMetadata\)/)
  assert.match(vaultServiceSource, /status\.vaultBinding !== binding/)
  assert.match(vaultServiceSource, /unlockAndroidBiometricVault\(binding\)/)
  assert.match(vaultServiceSource, /importTrustedDeviceVaultKey\(encodedVaultKey\)/)
  assert.match(vaultServiceSource, /setActiveVaultKey\(vaultKey\)/)
  assert.match(vaultServiceSource, /maybeEnableAndroidBiometricUnlock\(password, metadata\)/)
})

test('cold-start biometric bridge uses a bounded settle window only for transient unavailability', () => {
  assert.match(biometricBridgeSource, /TRANSIENT_COLD_START_RETRY_DELAYS_MS = \[180, 420, 800\] as const/)
  assert.match(biometricBridgeSource, /function shouldRetryTransientColdStart/)
  assert.match(biometricBridgeSource, /!result\.unlocked/)
  assert.match(biometricBridgeSource, /!result\.cancelled/)
  assert.match(biometricBridgeSource, /result\.reason === 'unavailable'/)
  assert.match(biometricBridgeSource, /for \(const delay of TRANSIENT_COLD_START_RETRY_DELAYS_MS\)/)
  assert.match(biometricBridgeSource, /if \(!shouldRetryTransientColdStart\(result\)\) return result/)
  assert.match(biometricBridgeSource, /await waitForNativeActivity\(delay\)/)
  assert.match(biometricBridgeSource, /result = await withAndroidSystemInteraction/)
  assert.doesNotMatch(biometricBridgeSource, /authentication-error[^\n]*retry/i)
})

test('vault key imported from Android is immediately converted to a nonextractable Web Crypto key', () => {
  assert.match(trustedKeySource, /VAULT_KEY_LENGTH = 32/)
  assert.match(trustedKeySource, /subtle\.importKey\(/)
  assert.match(trustedKeySource, /\{ name: 'AES-GCM' \},\s*false,/)
  assert.match(trustedKeySource, /\['encrypt', 'decrypt'\]/)
  assert.match(trustedKeySource, /copy\.fill\(0\)/)
})
