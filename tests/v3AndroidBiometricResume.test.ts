import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const appSource = readFileSync('src/app/App.tsx', 'utf8')
const biometricSource = readFileSync('src/platform/android/biometricVault.ts', 'utf8')
const cameraSource = readFileSync('src/platform/android/nativeCamera.ts', 'utf8')
const documentsSource = readFileSync('src/platform/android/nativeDocuments.ts', 'utf8')
const guardSource = readFileSync('src/platform/android/systemInteractionGuard.ts', 'utf8')

test('Android backgrounding clears the active vault key and remounts the vault gate on resume', () => {
  assert.match(appSource, /document\.addEventListener\('visibilitychange'/)
  assert.match(appSource, /document\.visibilityState === 'hidden'/)
  assert.match(appSource, /lockLocalVault\(\)/)
  assert.match(appSource, /androidWasBackgrounded\.current = true/)
  assert.match(appSource, /setVaultGateRevision\(\(value\) => value \+ 1\)/)
  assert.match(appSource, /key=\{vaultGateRevision\}/)
})

test('Android system-owned flows are excluded from background re-locking', () => {
  assert.match(appSource, /isAndroidSystemInteractionActive\(\)/)
  assert.match(guardSource, /activeSystemInteractions \+= 1/)
  assert.match(guardSource, /activeSystemInteractions = Math\.max\(0, activeSystemInteractions - 1\)/)
  assert.match(biometricSource, /withAndroidSystemInteraction\(\(\) => nativeBiometric\.unlock/)
  assert.match(biometricSource, /withAndroidSystemInteraction\(\(\) => nativeBiometric\.enable/)
  assert.match(cameraSource, /withAndroidSystemInteraction\(\(\) => nativeCamera\.takePhoto\(\)\)/)
  assert.match(documentsSource, /withAndroidSystemInteraction\(\(\) => nativeDocuments\.beginSaveBackup/)
  assert.match(documentsSource, /withAndroidSystemInteraction\(\(\) => nativeDocuments\.openBackup\(\)\)/)
})

test('resume lock remains Android-only and does not change the PWA lifecycle', () => {
  assert.match(appSource, /if \(!isAndroidBiometricRuntime\(\)\) return/)
})
