import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('MainActivity registers Android back and explicit device credential plugins', () => {
  const activity = readFileSync(
    'android/app/src/main/java/io/github/hnalvaradohn/oanix/MainActivity.java',
    'utf8',
  )

  assert.match(activity, /registerPlugin\(OanixBackPlugin\.class\)/)
  assert.match(activity, /registerPlugin\(OanixDeviceCredentialPlugin\.class\)/)
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

test('Android back runtime confirms exit on home and exits on the second back gesture', () => {
  const runtime = readFileSync('src/platform/android/AndroidBackRuntime.tsx', 'utf8')
  const plugin = readFileSync(
    'android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixBackPlugin.java',
    'utf8',
  )

  assert.match(runtime, /¿Deseas salir de OANIX\?/)
  assert.match(runtime, /Si vuelves a usar Atrás, OANIX se cerrará\./)
  assert.match(runtime, /exitPromptVisibleRef\.current[\s\S]*exitAndroidApp\(\)/)
  assert.match(runtime, /Cancel(?:ar)?/)
  assert.match(runtime, /Salir/)
  assert.match(plugin, /OnBackPressedCallback/)
  assert.match(plugin, /notifyListeners\("backPressed"/)
  assert.match(plugin, /activity::finish/)
})

test('device credential unlock explicitly requests Android PIN pattern or device password', () => {
  const plugin = readFileSync(
    'android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixDeviceCredentialPlugin.java',
    'utf8',
  )
  const runtime = readFileSync(
    'src/platform/android/AndroidDeviceCredentialRetryRuntime.tsx',
    'utf8',
  )

  assert.match(plugin, /Authenticators\.DEVICE_CREDENTIAL/)
  assert.match(plugin, /setAllowedAuthenticators\(BiometricManager\.Authenticators\.DEVICE_CREDENTIAL\)/)
  assert.match(plugin, /Usa el PIN, patrón o contraseña de tu teléfono/)
  assert.match(plugin, /KEY_ALIAS = "oanix\.biometric-vault\.v2"/)
  assert.match(plugin, /PREFS_NAME = "oanix\.biometric-vault"/)
  assert.doesNotMatch(plugin, /putString\([^\n]*(pin|pattern|password)/i)
  assert.match(runtime, /Usar PIN o patrón del teléfono/)
})

test('device credential result imports the same vault key as a non-extractable trusted device key', () => {
  const service = readFileSync('src/platform/android/deviceCredentialVault.ts', 'utf8')

  assert.match(service, /readVaultMetadata\(\)/)
  assert.match(service, /primary:\$\{createdAt\}/)
  assert.match(service, /importTrustedDeviceVaultKey\(encodedVaultKey\)/)
  assert.match(service, /setActiveVaultKey\(key\)/)
})
