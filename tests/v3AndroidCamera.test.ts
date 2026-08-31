import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const pluginSource = readFileSync(
  'android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixCameraPlugin.java',
  'utf8',
)
const mainActivitySource = readFileSync(
  'android/app/src/main/java/io/github/hnalvaradohn/oanix/MainActivity.java',
  'utf8',
)
const manifestSource = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8')
const cameraBridgeSource = readFileSync('src/platform/android/nativeCamera.ts', 'utf8')
const cameraRuntimeSource = readFileSync('src/platform/android/NativeCameraRuntime.tsx', 'utf8')
const imageEditorSource = readFileSync('src/features/images/ImageNoteEditor.tsx', 'utf8')
const appSource = readFileSync('src/app/App.tsx', 'utf8')

test('native camera captures into OANIX private cache through FileProvider without gallery permissions', () => {
  assert.match(pluginSource, /MediaStore\.ACTION_IMAGE_CAPTURE/)
  assert.match(pluginSource, /getContext\(\)\.getCacheDir\(\)/)
  assert.match(pluginSource, /FileProvider\.getUriForFile/)
  assert.match(pluginSource, /MediaStore\.EXTRA_OUTPUT/)
  assert.match(pluginSource, /FLAG_GRANT_READ_URI_PERMISSION/)
  assert.match(pluginSource, /FLAG_GRANT_WRITE_URI_PERMISSION/)
  assert.doesNotMatch(pluginSource, /MediaStore\.Images\.Media\.insertImage/)
  assert.doesNotMatch(manifestSource, /android\.permission\.CAMERA/)
  assert.doesNotMatch(manifestSource, /WRITE_EXTERNAL_STORAGE|READ_MEDIA_IMAGES/)
})

test('native capture is bounded, restorable across activity recreation, and cleaned after import', () => {
  assert.match(pluginSource, /MAX_CAPTURE_BYTES = 24L \* 1024L \* 1024L/)
  assert.match(pluginSource, /STALE_CAPTURE_MS = 60L \* 60L \* 1000L/)
  assert.match(pluginSource, /protected Bundle saveInstanceState\(\)/)
  assert.match(pluginSource, /protected void restoreState\(Bundle state\)/)
  assert.match(pluginSource, /STATE_CAPTURE_PATH/)
  assert.match(pluginSource, /STATE_CAPTURE_URI/)
  assert.match(pluginSource, /public void finishPhoto\(PluginCall call\)/)
  assert.match(pluginSource, /cleanupPendingCapture\(\)/)
})

test('camera JPEG crosses into WebView by private content URI rather than Base64 payload', () => {
  assert.match(pluginSource, /response\.put\("uri", pendingCaptureUri\.toString\(\)\)/)
  assert.doesNotMatch(pluginSource, /response\.put\("base64"/)
  assert.match(cameraBridgeSource, /Capacitor\.convertFileSrc\(result\.uri\)/)
  assert.match(cameraBridgeSource, /fetch\(Capacitor\.convertFileSrc\(result\.uri\)/)
  assert.match(cameraBridgeSource, /await nativeCamera\.finishPhoto\(\)/)
  assert.match(cameraBridgeSource, /return new File\(\[blob\]/)
})

test('Android camera pipeline remains preserved but is deferred from the text-note rebuild milestone', () => {
  assert.match(mainActivitySource, /registerPlugin\(OanixCameraPlugin\.class\)/)
  assert.match(appSource, /<RebuildApp onLock=\{lockVault\} \/>/)
  assert.doesNotMatch(appSource, /<NativeCameraRuntime \/>/)
  assert.match(cameraRuntimeSource, /input\.files = transfer\.files/)
  assert.match(cameraRuntimeSource, /input\.dispatchEvent\(new Event\('change'/)
  assert.match(imageEditorSource, /async function handleFileChange/)
  assert.match(imageEditorSource, /await insertFiles\(files\)/)
  assert.match(imageEditorSource, /const stored = await storeEncryptedImage\(file\)/)
})

test('camera action is exposed only in native Android and preserves the current insertion point', () => {
  assert.match(cameraBridgeSource, /Capacitor\.isNativePlatform\(\) && Capacitor\.getPlatform\(\) === 'android'/)
  assert.match(cameraRuntimeSource, /rememberCurrentInsertionPoint\(root\)/)
  assert.match(cameraRuntimeSource, /data-image-tool/)
  assert.match(cameraRuntimeSource, /new MouseEvent\('mousedown'/)
  assert.match(cameraRuntimeSource, /editor-command-grid--insert/)
  assert.match(cameraRuntimeSource, /editor-toolbar/)
})
