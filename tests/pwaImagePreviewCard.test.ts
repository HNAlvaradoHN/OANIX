import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const runtime = readFileSync('src/features/images/PwaImagePreviewRuntime.tsx', 'utf8')
const css = readFileSync('src/features/images/pwa-image-preview.css', 'utf8')

test('the approved fixed image card is mounted in both PWA and Capacitor without changing the shared editor', () => {
  assert.match(main, /<PwaImagePreviewRuntime \/>/)
  assert.doesNotMatch(main, /!isCapacitorBuild && <PwaImagePreviewRuntime \/>/)
  assert.doesNotMatch(runtime, /import\.meta\.env\.MODE === 'capacitor'/)
  assert.match(runtime, /oanix-pwa-image-preview-v1/)
})

test('image movement and resize are disabled while preview opens the original image', () => {
  assert.match(runtime, /data-image-preview="true"/)
  assert.match(runtime, /event\.stopPropagation\(\)/)
  assert.match(runtime, /data-image-open-action="true"/)
  assert.match(runtime, /open\.click\(\)/)
  assert.match(css, /float: none !important/)
  assert.match(css, /editor-image-block__resize[\s\S]*editor-image-block__lock[\s\S]*editor-image-block__alignment/)
  assert.match(css, /display: none !important/)
})

test('preview stays compact on the left and readable actions stay on the right', () => {
  assert.match(runtime, /data-pwa-image-top="true"/)
  assert.match(runtime, /top\.append\(preview\)/)
  assert.match(runtime, /top\.append\(actions\)/)
  assert.match(runtime, /actions\.prepend\(meta\)/)
  assert.match(css, /grid-template-columns: minmax\(8rem, 42%\) minmax\(0, 1fr\)/)
  assert.match(css, /aspect-ratio: 4 \/ 3 !important/)
  assert.match(css, /object-fit: contain !important/)
  assert.match(css, /width: min\(100%, 34rem\) !important/)
})

test('description uses the full lower bar, truncates visually, and exposes a complete-text bubble', () => {
  assert.match(runtime, /DESCRIPTION_LIMIT = 56/)
  assert.match(runtime, /data-pwa-image-description-row/)
  assert.match(runtime, /data-pwa-image-description-more/)
  assert.match(runtime, /Leer descripción completa/)
  assert.match(runtime, /pwa-image-description-overlay/)
  assert.match(runtime, /pwa-image-description-bubble__text/)
  assert.match(css, /text-overflow: ellipsis/)
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) auto/)
  assert.match(css, /pwa-image-description-bubble/)
})

test('description and image overlays close with outside tap, Escape, or browser back', () => {
  assert.match(runtime, /history\.pushState/)
  assert.match(runtime, /history\.back\(\)/)
  assert.match(runtime, /window\.addEventListener\('popstate'/)
  assert.match(runtime, /event\.key !== 'Escape'/)
  assert.match(runtime, /target === descriptionBubble/)
  assert.match(runtime, /target === currentLightbox/)
  assert.match(runtime, /image-lightbox__close/)
})

test('lightbox supports pinch zoom and one-finger pan after zoom', () => {
  assert.match(runtime, /touchPoints = new Map/)
  assert.match(runtime, /pointDistance/)
  assert.match(runtime, /pinchStartScale \* \(distance \/ pinchStartDistance\)/)
  assert.match(runtime, /MAX_ZOOM = 4/)
  assert.match(runtime, /viewport\.scrollLeft/)
  assert.match(runtime, /viewport\.scrollTop/)
  assert.match(css, /image-lightbox__viewport[\s\S]*touch-action: none/)
})
