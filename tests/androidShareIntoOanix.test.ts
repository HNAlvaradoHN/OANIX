import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('Android advertises OANIX for text and image share intents without broad storage permissions', () => {
  const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8')

  assert.match(manifest, /android\.intent\.action\.SEND/)
  assert.match(manifest, /android\.intent\.action\.SEND_MULTIPLE/)
  assert.match(manifest, /android:mimeType="text\/plain"/)
  assert.match(manifest, /android:mimeType="image\/\*"/)
  assert.doesNotMatch(manifest, /android:mimeType="\*\/\*"/)
  assert.doesNotMatch(manifest, /READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE|READ_MEDIA_IMAGES/)
})

test('Android refreshes the Activity intent and registers the native share bridge', () => {
  const activity = readFileSync(
    'android/app/src/main/java/io/github/hnalvaradohn/oanix/MainActivity.java',
    'utf8',
  )

  assert.match(activity, /registerPlugin\(OanixSharePlugin\.class\)/)
  assert.match(activity, /onNewIntent\(Intent intent\)/)
  assert.match(activity, /setIntent\(intent\)/)
})

test('incoming content is prepared only after the unlocked runtime asks for it', () => {
  const app = readFileSync('src/app/App.tsx', 'utf8')
  const runtime = readFileSync('src/platform/android/NativeShareRuntime.tsx', 'utf8')
  const service = readFileSync('src/platform/android/nativeShare.ts', 'utf8')
  const plugin = readFileSync(
    'android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixSharePlugin.java',
    'utf8',
  )

  assert.match(app, /function UnlockedApp/)
  assert.match(app, /<NativeShareRuntime/)
  assert.match(runtime, /importPendingAndroidShare\(\)/)
  assert.match(service, /nativeShare\.consumePendingShare\(\)/)
  assert.match(service, /storeEncryptedImage\(file\)/)
  assert.match(service, /createNoteWithContent/)
  assert.match(service, /finally[\s\S]*nativeShare\.finishShare\(\)/)
  assert.match(plugin, /consumePendingShare\(PluginCall call\)/)
  assert.match(plugin, /getActivity\(\)\.getIntent\(\)|activity\.getIntent\(\)/)
  assert.match(plugin, /File\.createTempFile\(SHARE_PREFIX/)
  assert.match(plugin, /cleanupAbandonedShareFiles\(\)/)
  assert.match(plugin, /finishShare\(PluginCall call\)/)
})

test('share limits and accepted image formats stay aligned with the encrypted image pipeline', () => {
  const service = readFileSync('src/platform/android/nativeShare.ts', 'utf8')
  const plugin = readFileSync(
    'android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixSharePlugin.java',
    'utf8',
  )

  assert.match(service, /MAX_SHARED_IMAGE_BYTES = 50 \* 1024 \* 1024/)
  assert.match(service, /MAX_SHARED_IMAGES = 10/)
  assert.match(plugin, /MAX_IMAGE_BYTES = 50L \* 1024L \* 1024L/)
  assert.match(plugin, /MAX_IMAGE_COUNT = 10/)
  assert.match(plugin, /MAX_TOTAL_BYTES = 120L \* 1024L \* 1024L/)
  assert.match(plugin, /"image\/jpeg"/)
  assert.match(plugin, /"image\/png"/)
  assert.match(plugin, /"image\/webp"/)
  assert.match(plugin, /"image\/gif"/)
})
