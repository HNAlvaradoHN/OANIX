import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('MainActivity registers Android back and device-security plugins', () => {
  const activity = readFileSync(
    'android/app/src/main/java/io/github/hnalvaradohn/oanix/MainActivity.java',
    'utf8',
  )

  assert.match(activity, /registerPlugin\(OanixBackPlugin\.class\)/)
  assert.match(activity, /registerPlugin\(OanixBiometricPlugin\.class\)/)
  assert.match(activity, /registerPlugin\(OanixDeviceCredentialPlugin\.class\)/)
})

test('Android back runtime closes the active rebuild layer through its explicit safe back contract', () => {
  const runtime = readFileSync('src/platform/android/AndroidBackRuntime.tsx', 'utf8')
  const rebuild = readFileSync('src/features/rebuild/RebuildApp.tsx', 'utf8')
  const editor = readFileSync('src/features/editor/NoteEditor.tsx', 'utf8')

  assert.match(runtime, /\[data-oanix-back-close="true"\]/)
  assert.match(runtime, /modalBackClose\.click\(\)/)
  assert.doesNotMatch(runtime, /notes-shell--open|folderNavigationRuntime/)
  assert.match(editor, /data-oanix-back-close="true"/)
  assert.match(editor, /data-oanix-save-and-close="true"/)
  assert.match(rebuild, /async function closeEditor\(snapshot: NoteEditorSnapshot \| null\)/)
  assert.match(rebuild, /current\.meta,[\s\S]*current\.text,[\s\S]*snapshot\.title,[\s\S]*snapshot\.text/)
})

test('Android back runtime confirms exit professionally and exits on the second back gesture', () => {
  const runtime = readFileSync('src/platform/android/AndroidBackRuntime.tsx', 'utf8')
  const plugin = readFileSync(
    'android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixBackPlugin.java',
    'utf8',
  )

  assert.match(runtime, /¿Deseas salir de OANIX\?/)
  assert.match(runtime, /Si vuelves a usar Atrás, OANIX se cerrará\./)
  assert.match(runtime, /exitPromptVisibleRef\.current[\s\S]*exitAndroidApp\(\)/)
  assert.match(runtime, /backdropFilter: 'blur\(10px\)'/)
  assert.match(runtime, /boxShadow: '0 22px 70px/)
  assert.match(runtime, /Cancelar/)
  assert.match(runtime, /Salir/)
  assert.match(plugin, /OnBackPressedCallback/)
  assert.match(plugin, /notifyListeners\("backPressed"/)
  assert.match(plugin, /activity::finish/)
})

test('quick unlock presents explicit device credential and biometric actions without collecting either secret', () => {
  const biometricPlugin = readFileSync(
    'android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixBiometricPlugin.java',
    'utf8',
  )
  const credentialPlugin = readFileSync(
    'android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixDeviceCredentialPlugin.java',
    'utf8',
  )
  const runtime = readFileSync(
    'src/platform/android/AndroidBiometricRetryRuntime.tsx',
    'utf8',
  )
  const app = readFileSync('src/app/App.tsx', 'utf8')

  assert.match(biometricPlugin, /BIOMETRIC_STRONG\s*\|\s*BiometricManager\.Authenticators\.DEVICE_CREDENTIAL/)
  assert.match(credentialPlugin, /Authenticators\.DEVICE_CREDENTIAL/)
  assert.match(runtime, /PIN, patrón o contraseña/)
  assert.match(runtime, /Usar huella/)
  assert.match(runtime, /unlockLocalVaultWithDeviceCredential\(\)/)
  assert.match(runtime, /unlockLocalVaultWithBiometrics\(\)/)
  assert.match(app, /<AndroidBiometricRetryRuntime/)
  assert.doesNotMatch(runtime, /pin\s*[:=]|pattern\s*[:=]|devicePassword\s*[:=]/i)
})

test('quick unlock is exposed on both local and synchronized vault password forms', () => {
  const runtime = readFileSync(
    'src/platform/android/AndroidBiometricRetryRuntime.tsx',
    'utf8',
  )
  const vaultGate = readFileSync('src/app/VaultGate.tsx', 'utf8')

  assert.match(vaultGate, /id="master-password"/)
  assert.match(vaultGate, /id="cloud-master-password"/)
  assert.match(runtime, /#master-password, #cloud-master-password/)
  assert.match(runtime, /passwordInput\?\.id === 'cloud-master-password' \? 'synced' : 'local'/)
})

test('synchronized quick unlock proves the local vault matches the connected account before opening', () => {
  const runtime = readFileSync(
    'src/platform/android/AndroidBiometricRetryRuntime.tsx',
    'utf8',
  )

  assert.match(runtime, /mode === 'synced'/)
  assert.match(runtime, /await ensureRemoteVaultBootstrap\(\)/)
  assert.match(runtime, /lockLocalVault\(\)/)
  assert.match(runtime, /otra bóveda local|otra clave de bóveda/)
  assert.match(runtime, /form-message/)
})

test('explicit device credential reuses the same authenticated Keystore envelope and never stores the phone secret', () => {
  const plugin = readFileSync(
    'android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixDeviceCredentialPlugin.java',
    'utf8',
  )

  assert.match(plugin, /Authenticators\.DEVICE_CREDENTIAL/)
  assert.match(plugin, /KEY_ALIAS = "oanix\.biometric-vault\.v2"/)
  assert.doesNotMatch(plugin, /putString\([^\n]*(pin|pattern|password)/i)
})
