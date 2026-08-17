import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8')
const activity = readFileSync(
  'android/app/src/main/java/io/github/hnalvaradohn/oanix/MainActivity.java',
  'utf8',
)
const plugin = readFileSync(
  'android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixAuthPlugin.java',
  'utf8',
)
const bridge = readFileSync('src/platform/android/nativeAccountAuth.ts', 'utf8')
const runtime = readFileSync('src/platform/android/AndroidAuthRuntime.tsx', 'utf8')
const account = readFileSync('src/features/account/accountService.ts', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')

test('Android declares a browsable OANIX auth callback and registers its native plugin', () => {
  assert.match(manifest, /android\.intent\.action\.VIEW/)
  assert.match(manifest, /android\.intent\.category\.BROWSABLE/)
  assert.match(manifest, /android:scheme="oanix"/)
  assert.match(manifest, /android:host="auth-callback"/)
  assert.match(activity, /registerPlugin\(OanixAuthPlugin\.class\)/)
})

test('native OAuth callback stays memory-only and its wake-up event carries no tokens', () => {
  assert.match(plugin, /pendingCallbackUrl/)
  assert.match(plugin, /notifyListeners\("authCallback", signal, false\)/)
  assert.match(plugin, /signal\.put\("pending", true\)/)
  assert.doesNotMatch(plugin, /getSharedPreferences\s*\(/)
  assert.doesNotMatch(plugin, /SharedPreferences\s+[A-Za-z_]/)
  assert.doesNotMatch(plugin, /new\s+FileOutputStream\s*\(/)
  assert.doesNotMatch(plugin, /void\s+onSaveInstanceState\s*\(/)
  assert.doesNotMatch(plugin, /signal\.put\("url"/)
  assert.match(plugin, /pendingCallbackUrl = null/)
})

test('Android only opens HTTPS OAuth pages and accepts only OANIX callback URLs', () => {
  assert.match(plugin, /"https"\.equalsIgnoreCase\(uri\.getScheme\(\)\)/)
  assert.match(plugin, /CALLBACK_SCHEME = "oanix"/)
  assert.match(plugin, /CALLBACK_HOST = "auth-callback"/)
  assert.match(bridge, /ANDROID_OAUTH_REDIRECT_URL = 'oanix:\/\/auth-callback'/)
})

test('Supabase Google auth uses native browser redirect on Android and imports returned session only', () => {
  assert.match(account, /isAndroidNativeAccountAuth\(\)/)
  assert.match(account, /redirectTo: ANDROID_OAUTH_REDIRECT_URL/)
  assert.match(account, /skipBrowserRedirect: true/)
  assert.match(account, /openAndroidOAuthUrl\(data\.url\)/)
  assert.match(account, /supabase\.auth\.setSession/)
  assert.match(account, /supabase\.auth\.exchangeCodeForSession/)
  assert.doesNotMatch(account, /setActiveVaultKey|unlockLocalVault/)
})

test('OAuth callback runtime is mounted independently from the unlocked vault tree', () => {
  assert.match(runtime, /consumePendingAndroidAuthCallback/)
  assert.match(runtime, /completeOnlineAccountFromRedirect/)
  assert.match(app, /<AndroidAuthRuntime \/>[\s\S]*<NativeDocumentsRuntime \/>[\s\S]*<VaultGate/)
})
