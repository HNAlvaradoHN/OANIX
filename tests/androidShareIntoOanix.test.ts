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

test('Android publishes the newest Activity intent before Capacitor dispatches it', () => {
  const activity = readFileSync(
    'android/app/src/main/java/io/github/hnalvaradohn/oanix/MainActivity.java',
    'utf8',
  )

  assert.match(activity, /registerPlugin\(OanixSharePlugin\.class\)/)
  assert.match(activity, /onNewIntent\(Intent intent\)/)
  const setIntentIndex = activity.indexOf('setIntent(intent)')
  const superIndex = activity.indexOf('super.onNewIntent(intent)')
  assert.ok(setIntentIndex >= 0)
  assert.ok(superIndex >= 0)
  assert.ok(setIntentIndex < superIndex)
})

test('native share intents are queued only in memory and signal repeated warm deliveries', () => {
  const plugin = readFileSync(
    'android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixSharePlugin.java',
    'utf8',
  )

  assert.match(plugin, /ArrayDeque<Intent> pendingShareIntents/)
  assert.match(plugin, /handleOnNewIntent\(Intent intent\)/)
  assert.match(plugin, /pendingShareIntents\.addLast\(new Intent\(intent\)\)/)
  assert.match(plugin, /notifyListeners\("shareReceived", signal, false\)/)
  assert.match(plugin, /takePendingShareIntent\(Activity activity\)/)
  assert.match(plugin, /pendingShareIntents\.removeFirst\(\)/)
  assert.match(plugin, /handleOnDestroy\(\)[\s\S]*pendingShareIntents\.clear\(\)/)
  assert.doesNotMatch(plugin, /SharedPreferences/)
  assert.doesNotMatch(plugin, /saveInstanceState|restoreState/)
})

test('legacy incoming-share pipeline stays preserved but is deferred from the rebuild milestone', () => {
  const app = readFileSync('src/app/App.tsx', 'utf8')
  const runtime = readFileSync('src/platform/android/NativeShareRuntime.tsx', 'utf8')
  const service = readFileSync('src/platform/android/nativeShare.ts', 'utf8')
  const plugin = readFileSync(
    'android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixSharePlugin.java',
    'utf8',
  )

  assert.match(app, /function UnlockedApp/)
  assert.match(app, /<RebuildApp onLock=\{lockVault\} \/>/)
  assert.doesNotMatch(app, /<NativeShareRuntime/)
  assert.match(runtime, /importPendingAndroidShare\(/)
  assert.match(runtime, /addAndroidShareReceivedListener/)
  assert.match(service, /nativeShare\.consumePendingShare\(\)/)
  assert.match(service, /storeEncryptedImage\(file\)/)
  assert.match(service, /createNoteWithContent/)
  assert.match(service, /finally[\s\S]*nativeShare\.finishShare\(\)/)
  assert.match(plugin, /consumePendingShare\(PluginCall call\)/)
  assert.match(plugin, /File\.createTempFile\(SHARE_PREFIX/)
  assert.match(plugin, /cleanupAbandonedShareFiles\(\)/)
  assert.match(plugin, /finishShare\(PluginCall call\)/)
})

test('share runtime shows local progress, drains repeated shares and opens the imported note', () => {
  const runtime = readFileSync('src/platform/android/NativeShareRuntime.tsx', 'utf8')
  const service = readFileSync('src/platform/android/nativeShare.ts', 'utf8')

  assert.match(runtime, /processPendingShares/)
  assert.match(runtime, /rerunRequested/)
  assert.match(runtime, /role="progressbar"/)
  assert.match(runtime, /Cifrado local · no requiere Internet/)
  assert.match(runtime, /findImportedNoteButton/)
  assert.match(runtime, /button\.click\(\)/)
  assert.match(runtime, /prioritizeEncryptedImagePreviews/)
  assert.match(runtime, /image\.loading = 'eager'/)
  assert.match(service, /Procesando foto \$\{currentImage\} de \$\{images\.length\}/)
  assert.match(service, /Guardando la nota cifrada/)
  assert.match(service, /phase: 'complete'/)
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
