import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const rebuild = readFileSync('src/features/rebuild/RebuildApp.tsx', 'utf8')
const back = readFileSync('src/platform/android/AndroidBackRuntime.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')

test('rebuild startup mounts no legacy workspace UI runtimes or visual layers', () => {
  assert.match(main, /<App \/>/)
  assert.doesNotMatch(
    main,
    /ThemeMenu|ThemeVisualStyles|PwaImagePreviewRuntime|DesktopImageViewportRuntime|mobileBackKeyboardGuard|WorkspaceRuntimeGate|LegacyWorkspaceRuntimeGate/,
  )
  assert.doesNotMatch(main, /WORKSPACE_V2_ENABLED|oanix-workspace-v2-active|oanix-v383-visual/)
})

test('rebuild owns its own CSS namespace instead of borrowing legacy notes-shell selectors', () => {
  assert.match(rebuild, /const shellClass = `rebuild-shell/)
  assert.match(rebuild, /rebuild-shell--open/)
  assert.doesNotMatch(rebuild, /notes-shell|notes-shell--open/)
})

test('Android back handling keeps native exit and modal behavior without legacy folder navigation', () => {
  assert.doesNotMatch(back, /folderNavigationRuntime|useFolderNavigationRuntime/)
  assert.doesNotMatch(back, /notes-shell--open|data-oanix-folder-home-back/)
  assert.match(back, /\[data-oanix-back-close="true"\]/)
  assert.match(back, /exitAndroidApp/)
})

test('security boundary remains outside the rebuild and still owns vault access', () => {
  assert.match(app, /<VaultGate/)
  assert.match(app, /<RebuildApp onLock=\{lockVault\} \/>/)
  assert.match(app, /AUTO_LOCK_CHANGE_EVENT/)
  assert.match(rebuild, /AUTO_LOCK_OPTIONS/)
  assert.match(rebuild, /saveAutoLockMinutes/)
})
