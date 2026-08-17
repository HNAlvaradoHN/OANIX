import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const pluginSource = readFileSync(
  'android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixDocumentsPlugin.java',
  'utf8',
)
const mainActivitySource = readFileSync(
  'android/app/src/main/java/io/github/hnalvaradohn/oanix/MainActivity.java',
  'utf8',
)
const manifestSource = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8')
const documentBridgeSource = readFileSync('src/platform/android/nativeDocuments.ts', 'utf8')
const documentRuntimeSource = readFileSync('src/platform/android/NativeDocumentsRuntime.tsx', 'utf8')
const backupServiceSource = readFileSync('src/features/backup/backupService.ts', 'utf8')
const vaultGateSource = readFileSync('src/app/VaultGate.tsx', 'utf8')
const appSource = readFileSync('src/app/App.tsx', 'utf8')

test('Android documents use Storage Access Framework without broad storage permissions', () => {
  assert.match(pluginSource, /Intent\.ACTION_OPEN_DOCUMENT/)
  assert.match(pluginSource, /Intent\.ACTION_CREATE_DOCUMENT/)
  assert.match(pluginSource, /Intent\.CATEGORY_OPENABLE/)
  assert.match(pluginSource, /Intent\.FLAG_GRANT_READ_URI_PERMISSION/)
  assert.match(pluginSource, /Intent\.FLAG_GRANT_WRITE_URI_PERMISSION/)
  assert.doesNotMatch(manifestSource, /READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE|READ_MEDIA_IMAGES/)
  assert.match(mainActivitySource, /registerPlugin\(OanixDocumentsPlugin\.class\)/)
})

test('encrypted backup export is streamed through bounded UTF-8 bridge chunks', () => {
  assert.match(pluginSource, /MAX_CHUNK_BYTES = 512 \* 1024/)
  assert.match(pluginSource, /openOutputStream\(uri, "w"\)/)
  assert.match(pluginSource, /activeOutput\.write\(bytes\)/)
  assert.match(pluginSource, /activeOutput\.flush\(\)/)
  assert.match(pluginSource, /closeActiveWrite\(true\)/)
  assert.match(documentBridgeSource, /STRING_CHUNK_CHARACTERS = 128 \* 1024/)
  assert.match(documentBridgeSource, /safeChunkEnd/)
  assert.match(documentBridgeSource, /writeBackupChunk/)
  assert.match(documentBridgeSource, /abortSaveBackup/)
  assert.doesNotMatch(documentBridgeSource, /btoa\(/)
})

test('existing backup service uses native Android save while keeping browser download elsewhere', () => {
  assert.match(backupServiceSource, /isAndroidNativeDocumentsRuntime\(\)/)
  assert.match(backupServiceSource, /saveEncryptedBackupWithAndroidDocuments\(serialized, fileName\)/)
  assert.match(backupServiceSource, /new Blob\(\[serialized\]/)
  assert.match(backupServiceSource, /anchor\.download = fileName/)
  assert.match(backupServiceSource, /serializeEncryptedBackup\(snapshot, now\)/)
})

test('Android restore picker feeds the existing validated restore file input', () => {
  assert.match(pluginSource, /openBackupResult/)
  assert.match(pluginSource, /OpenableColumns\.DISPLAY_NAME/)
  assert.match(pluginSource, /OpenableColumns\.SIZE/)
  assert.match(documentBridgeSource, /Capacitor\.convertFileSrc\(selection\.uri\)/)
  assert.match(documentBridgeSource, /return new File\(\[blob\], selection\.name/)
  assert.match(documentRuntimeSource, /input\.accept\.includes\('\.oanixbackup'\)/)
  assert.match(documentRuntimeSource, /input\.files = transfer\.files/)
  assert.match(documentRuntimeSource, /input\.dispatchEvent\(new Event\('change'/)
  assert.match(vaultGateSource, /restoreEncryptedBackupFromFile\(restoreFile, restorePassword\)/)
})

test('native documents runtime is Android-only and mounted before the locked vault UI', () => {
  assert.match(documentBridgeSource, /Capacitor\.isNativePlatform\(\) && Capacitor\.getPlatform\(\) === 'android'/)
  assert.match(documentRuntimeSource, /document\.addEventListener\('click', handleBackupPickerClick, true\)/)
  assert.match(appSource, /<NativeDocumentsRuntime \/>/)
  assert.match(appSource, /<VaultGate/)
})
