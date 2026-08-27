import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const brandCss = readFileSync('src/styles/web-brand-logo.css', 'utf8')

test('approved PWA brand does not animate continuously while idle', () => {
  assert.doesNotMatch(brandCss, /oanix-brand-float/)
  assert.doesNotMatch(brandCss, /oanix-brand-sheen/)
  assert.doesNotMatch(brandCss, /animation:[^;]*infinite/)
  assert.match(brandCss, /oanix-brand-pwa-preview[\s\S]*will-change:\s*auto/)
})
