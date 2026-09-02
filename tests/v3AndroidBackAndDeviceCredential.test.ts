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
  const drawer = readFileSync('src/features/rebuild/WorkspaceDrawer.tsx', 'utf8')
  const editorSurface = readFileSync('src/features/editor/EditorSurface.tsx', 'utf8')
  const editorSurfaceRegistry = readFileSync('src/features/editor/editorSurfaceRegistry.ts', 'utf8')
  const selectedEditorSurface = readFileSync(
    'src/features/editor/implementations/QwenSheetSurface.tsx',
    'utf8',
  )

  assert.match(runtime, /querySelectorAll<HTMLButtonElement>/)
  assert.match(runtime, /candidate\.closest\('\[aria-hidden="true"\]'\)/)
  assert.match(runtime, /activeBackClose\.click\(\)/)
  assert.doesNotMatch(runtime, /document\.querySelector<HTMLButtonElement>\([\s\S]*data-oanix-back-close/)
  assert.doesNotMatch(runtime, /notes-shell--open|folderNavigationRuntime/)
  assert.match(editorSurface, /const ActiveSurface = lazy\(activeEditorSurface\.load\)/)
  assert.match(editorSurface, /<Suspense fallback=\{null\}>/)
  assert.match(editorSurface, /<SelectedSurface \{\.\.\.surfaceProps\} \/>/)
  assert.match(editorSurfaceRegistry, /await import\([\s\S]*QwenSheetSurface/)
  assert.match(selectedEditorSurface, /data-oanix-back-close="true"/)
  assert.match(selectedEditorSurface, /data-oanix-save-and-close="true"/)
  assert.match(selectedEditorSurface, /async function requestClose/)
  assert.match(selectedEditorSurface, /await onRequestClose\(snapshot\)/)
  assert.match(drawer, /aria-hidden={!open}/)
  assert.match(drawer, /data-oanix-back-close="true"/)
  assert.match(rebuild, /async function closeEditor\(snapshot: EditorSurfaceSnapshot \| null\)/)
  assert.match(rebuild, /current\.meta,[\s\S]*current\.text,[\s\S]*snapshot\.title,[\s\S]*snapshot\.text/)
})

test('Android back uses one AndroidX dispatcher with predictive back enabled', () => {
  const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8')
  const plugin = readFileSync(
    'android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixBackPlugin.java',
    'utf8',
  )

  assert.match(manifest, /android:enableOnBackInvokedCallback="true"/)
  assert.match(plugin, /OnBackPressedCallback/)
  assert.match(plugin, /getOnBackPressedDispatcher\(\)\.addCallback/)
  assert.match(plugin, /callback\.setEnabled\(enabled\)/)
  assert.match(plugin, /notifyListeners\("backPressed"/)
  assert.doesNotMatch(plugin, /OnBackInvokedDispatcher|registerOnBackInvokedCallback|unregisterOnBackInvokedCallback/)
})

test('Android back listener is attached before native interception and failures release interception', () => {
  const runtime = readFileSync('src/platform/android/AndroidBackRuntime.tsx', 'utf8')
  const listenerIndex = runtime.indexOf('addAndroidBackPressedListener(handleBack)')
  const enableIndex = runtime.indexOf('setAndroidBackHandlingEnabled(true)')

  assert.ok(listenerIndex >= 0)
  assert.ok(enableIndex > listenerIndex)
  assert.match(runtime, /await handle\.remove\(\)[\s\S]*setAndroidBackHandlingEnabled\(false\)/)
  assert.match(runtime, /Never leave Android back intercepted without a live JS listener/)
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

  assert.match(biometricPlugin, /BiometricPrompt/)
  assert.match(credentialPlugin, /BiometricPrompt/)
  assert.match(credentialPlugin, /BiometricManager\.Authenticators\.DEVICE_CREDENTIAL/)
  assert.match(
    credentialPlugin,
    /setAllowedAuthenticators\(BiometricManager\.Authenticators\.DEVICE_CREDENTIAL\)/,
  )
})
