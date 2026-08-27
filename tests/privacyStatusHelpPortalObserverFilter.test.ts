import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/privacy/PrivacyStatusHelp.tsx', 'utf8')

test('privacy help portal observer ignores unrelated body mutations', () => {
  assert.match(runtime, /const PRIVACY_ACTIONS_SELECTOR = '\.oanix-privacy-actions'/)
  assert.match(runtime, /function mutationTouchesPrivacyActions\(record: MutationRecord\)/)
  assert.match(runtime, /records\.some\(mutationTouchesPrivacyActions\)/)
  assert.match(runtime, /portalObserver\.observe\(document\.body, \{ childList: true \}\)/)
  assert.doesNotMatch(runtime, /const portalObserver = new MutationObserver\(scheduleInspect\)/)
})
