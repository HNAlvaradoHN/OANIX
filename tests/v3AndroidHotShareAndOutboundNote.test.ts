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

test('the same share action is available from each note list overflow menu', () => {
  const runtime = readFileSync('src/platform/android/NativeNoteShareRuntime.tsx', 'utf8')
  const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')

  assert.match(workspace, /className="note-row__menu"/)
  assert.match(workspace, /data-reorder-note-id=\{note\.id\}/)
  assert.match(runtime, /querySelector<HTMLElement>\('\.note-row__menu'\)/)
  assert.match(runtime, /closest<HTMLElement>\('\[data-reorder-note-id\]'\)/)
  assert.match(runtime, /handleShare\(listTarget\.noteId\)/)
  assert.match(runtime, /listTarget\.element/)
})

test('PDF export remains outside this V3 sharing path', () => {
  const runtime = readFileSync('src/platform/android/NativeNoteShareRuntime.tsx', 'utf8')
  const bridge = readFileSync('src/platform/android/outboundShare.ts', 'utf8')

  assert.doesNotMatch(runtime, /pdf/i)
  assert.doesNotMatch(bridge, /pdf/i)
})
