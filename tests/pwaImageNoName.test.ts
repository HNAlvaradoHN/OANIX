import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const runtime = readFileSync('src/features/images/PwaImagePreviewRuntime.tsx', 'utf8')
const css = readFileSync('src/features/images/pwa-image-preview.css', 'utf8')

test('legacy image-card presentation remains preserved but is detached from the rebuild entrypoint', () => {
  assert.doesNotMatch(main, /pwa-image-no-name\.css/)
  assert.doesNotMatch(main, /PwaImagePreviewRuntime|pwa-image-preview\.css/)
  assert.match(runtime, /pwa-image-preview\.css/)
  assert.match(css, /html\.oanix-pwa-image-preview-v1/)
  assert.match(css, /editor-image-block__name-toggle/)
  assert.match(css, /data-image-name='true'/)
  assert.match(css, /display: none !important/)
})