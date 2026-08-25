import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const bulkPrivacy = readFileSync('src/features/privacy/NoteBulkPrivacyRuntime.tsx', 'utf8')
const nativeCamera = readFileSync('src/platform/android/NativeCameraRuntime.tsx', 'utf8')
const nativeNoteShare = readFileSync('src/platform/android/NativeNoteShareRuntime.tsx', 'utf8')
const nativeShare = readFileSync('src/platform/android/NativeShareRuntime.tsx', 'utf8')
const keystoreDiagnostic = readFileSync('src/platform/android/AndroidKeystoreDiagnosticRuntime.tsx', 'utf8')

test('bulk privacy observes note rows only inside the notes workspace', () => {
  assert.match(bulkPrivacy, /document\.querySelector<HTMLElement>\('\.notes-shell'\)/)
  assert.match(bulkPrivacy, /observer\.observe\(workspace, \{ childList: true, subtree: true \}\)/)
  assert.doesNotMatch(bulkPrivacy, /observer\.observe\(document\.body/)
})

test('low-risk Android DOM observers stay inside the React root', () => {
  for (const runtime of [nativeCamera, nativeNoteShare, nativeShare, keystoreDiagnostic]) {
    assert.match(runtime, /document\.getElementById\('root'\)/)
    assert.match(runtime, /observer\.observe\(appRoot, \{ childList: true, subtree: true \}\)/)
    assert.doesNotMatch(runtime, /observer\.observe\(document\.body/)
    assert.doesNotMatch(runtime, /observer\.observe\(document\.documentElement/)
  }
})
