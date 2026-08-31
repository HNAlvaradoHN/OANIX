import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('warm inbound shares stay queued until the vault is actually unlocked', () => {
  const runtime = readFileSync('src/platform/android/NativeShareRuntime.tsx', 'utf8')
  const plugin = readFileSync(
    'android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixSharePlugin.java',
    'utf8',
  )

  assert.match(runtime, /isVaultUnlocked\(\)/)
  assert.match(runtime, /if \(!isVaultUnlocked\(\)\)[\s\S]*rerunRequested = true[\s\S]*return/)
  assert.match(runtime, /addAndroidShareReceivedListener/)
  assert.match(plugin, /pendingShareIntents\.addLast\(new Intent\(intent\)\)/)
  assert.match(plugin, /memory-only/)
})

test('outbound note sharing uses Android text share without exporting encrypted image blobs', () => {
  const activity = readFileSync(
    'android/app/src/main/java/io/github/hnalvaradohn/oanix/MainActivity.java',
    'utf8',
  )
  const plugin = readFileSync(
    'android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixOutboundSharePlugin.java',
    'utf8',
  )
  const runtime = readFileSync('src/platform/android/NativeNoteShareRuntime.tsx', 'utf8')

  assert.match(activity, /registerPlugin\(OanixOutboundSharePlugin\.class\)/)
  assert.match(plugin, /Intent\.ACTION_SEND/)
  assert.match(plugin, /setType\("text\/plain"\)/)
  assert.match(plugin, /Intent\.createChooser/)
  assert.match(runtime, /Compartir nota/)
  assert.match(runtime, /noteBlocksToFullPlainText/)
  assert.doesNotMatch(runtime, /deleteEncryptedImage|storeEncryptedImage|imageId\s*:/)
})

test('note sharing remains text-only while the outbound bridge also supports explicit PDF export', () => {
  const runtime = readFileSync('src/platform/android/NativeNoteShareRuntime.tsx', 'utf8')
  const bridge = readFileSync('src/platform/android/outboundShare.ts', 'utf8')

  assert.doesNotMatch(runtime, /pdf/i)
  assert.match(bridge, /sharePlainText/)
  assert.match(bridge, /sharePdfTextOnAndroid/)
})
