import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const css = readFileSync('src/features/images/pwa-image-no-name.css', 'utf8')

test('approved image cards hide filename and the show-hide name control in PWA and Capacitor', () => {
  assert.match(main, /pwa-image-no-name\.css/)
  assert.match(main, /<PwaImagePreviewRuntime \/>/)
  assert.doesNotMatch(main, /!isCapacitorBuild && <PwaImagePreviewRuntime \/>/)
  assert.match(css, /html\.oanix-pwa-image-preview-v1/)
  assert.match(css, /editor-image-block__name-toggle/)
  assert.match(css, /data-image-name='true'/)
  assert.match(css, /display: none !important/)
})
