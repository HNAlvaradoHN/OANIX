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
})

test('Android back runtime returns from an open note through the existing safe back action', () => {
  const runtime = readFileSync('src/platform/android/AndroidBackRuntime.tsx', 'utf8')
  const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')

  assert.match(runtime, /\.notes-shell--open \.back-button/)
  assert.match(runtime, /openNoteBack\.click\(\)/)
  assert.match(workspace, /async function handleBack\(\)/)
  assert.match(workspace, /await flushPendingContent\(\)/)
  assert.match(workspace, /await finalizeRemovedImages\(\)/)
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

test('one quick-unlock action delegates PIN pattern password or strong biometric to Android', () => {
  const biometricPlugin = readFileSync(
    'android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixBiometricPlugin.java',
    'utf8',
  )
  const runtime = readFileSync(
    'src/platform/android/AndroidBiometricRetryRuntime.tsx',
    'utf8',
  )
  const app = readFileSync('src/app/App.tsx', 'utf8')

  assert.match(biometricPlugin, /BIOMETRIC_STRONG\s*\|\s*BiometricManager\.Authenticators\.DEVICE_CREDENTIAL/)
  assert.match(runtime, /Usar PIN, patrón o huella/)
  assert.match(runtime, /unlockLocalVaultWithBiometrics\(\)/)
  assert.match(app, /<AndroidBiometricRetryRuntime/)
  assert.doesNotMatch(app, /<AndroidDeviceCredentialRetryRuntime/)
})

test('legacy explicit device credential path remains secure but is not exposed as a second UI action', () => {
  const plugin = readFileSync(
    'android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixDeviceCredentialPlugin.java',
    'utf8',
  )

  assert.match(plugin, /Authenticators\.DEVICE_CREDENTIAL/)
  assert.match(plugin, /KEY_ALIAS = "oanix\.biometric-vault\.v2"/)
  assert.doesNotMatch(plugin, /putString\([^\n]*(pin|pattern|password)/i)
})
