import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const gradle = readFileSync('android/app/build.gradle', 'utf8')
const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8')
const capacitor = readFileSync('capacitor.config.ts', 'utf8')
const biometric = readFileSync('android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixBiometricPlugin.java', 'utf8')
const androidWorkflow = readFileSync('.github/workflows/android.yml', 'utf8')
const historyPolicy = readFileSync('src/features/versionHistory/versionHistoryPolicy.ts', 'utf8')
const historyService = readFileSync('src/features/versionHistory/versionHistoryService.ts', 'utf8')
const conflicts = readFileSync('src/features/sync/conflictService.ts', 'utf8')

test('RC keeps Android package identity stable while field validation is active', () => {
  assert.match(capacitor, /appId: 'io\.github\.hnalvaradohn\.oanix'/)
  assert.match(gradle, /applicationId "io\.github\.hnalvaradohn\.oanix"/)

  const versionCode = Number(gradle.match(/versionCode\s+(\d+)/)?.[1] ?? 0)
  assert.ok(versionCode >= 2, 'RC versionCode must not go backwards')
})

test('RC Android permissions stay minimal', () => {
  const permissions = [...manifest.matchAll(/<uses-permission android:name="([^"]+)"\s*\/>/g)].map((match) => match[1]).sort()
  assert.deepEqual(permissions, [
    'android.permission.INTERNET',
    'android.permission.USE_BIOMETRIC',
  ])
  assert.doesNotMatch(manifest, /MANAGE_EXTERNAL_STORAGE|READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|READ_MEDIA_IMAGES/)
})

test('RC biometric unlock never weakens the authenticated-device policy', () => {
  assert.match(biometric, /BiometricManager\.Authenticators\.BIOMETRIC_STRONG/)
  assert.match(biometric, /BiometricManager\.Authenticators\.DEVICE_CREDENTIAL/)
  assert.match(biometric, /KeyProperties\.AUTH_BIOMETRIC_STRONG\s*\|\s*KeyProperties\.AUTH_DEVICE_CREDENTIAL/)
  assert.doesNotMatch(biometric, /BIOMETRIC_WEAK/)
})

test('RC main APK remains fail-closed on stable debug signing', () => {
  assert.match(androidWorkflow, /secrets\.OANIX_DEBUG_KEYSTORE_BASE64/)
  assert.match(androidWorkflow, /if \[ -z "\$OANIX_DEBUG_KEYSTORE_BASE64" \]/)
  assert.match(androidWorkflow, /EXPECTED_SHA256="ad4aae0c14ee8a78617fed361baf6f4fb9236650f5cc6e724cfbe992ff5c394a"/)
  assert.match(androidWorkflow, /rm -f "\$GITHUB_WORKSPACE\/android\/app\/oanix-stable-debug\.keystore"/)
  assert.match(gradle, /debug \{[\s\S]*signingConfig signingConfigs\.debug/)
  assert.doesNotMatch(gradle, /release \{[\s\S]{0,250}signingConfig signingConfigs\.debug/)
})

test('RC preserves version-history safety guarantees pending field validation', () => {
  assert.match(historyPolicy, /NOTE_HISTORY_AUTOMATIC_WINDOW_MS = 5 \* 60 \* 1000/)
  assert.match(historyPolicy, /NOTE_HISTORY_MAX_SNAPSHOTS_PER_NOTE = 5/)
  assert.match(historyService, /capturePreRestoreVersion[\s\S]*'pre-restore'/)
  assert.match(historyService, /findMissingHistoricalImageIds/)
  assert.match(historyService, /pruneNoteHistory/)
  assert.match(historyService, /sameNoteState/)
})

test('RC preserves conflict-resolution guards pending two-device field validation', () => {
  assert.match(conflicts, /SyncConflictResolutionChoice = 'local' \| 'remote' \| 'combine'/)
  assert.match(conflicts, /if \(!conflict \|\| conflict\.token !== token\)/)
  assert.match(conflicts, /eq\('version', current\.version\)/)
  assert.match(conflicts, /Otro dispositivo cambió esta versión mientras la resolvías\. OANIX no sobrescribió nada\./)
  assert.match(conflicts, /No se puede combinar una eliminación con contenido\./)
  assert.match(conflicts, /applyStoredEncryptedRecordChanges/)
  assert.match(conflicts, /oanix:conflict-resolved/)
})
