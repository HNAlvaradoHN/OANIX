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

test('image description is a local editing host inside an atomic image card', () => {
  assert.match(runtime, /querySelector<HTMLElement>\('\[data-image-alt="true"\]'\)/)
  assert.match(runtime, /function descriptionValue\(input: HTMLElement\)/)
  assert.doesNotMatch(runtime, /querySelector<HTMLInputElement>\('\[data-image-alt="true"\]'\)/)
  assert.match(css, /editor-image-block__alt[\s\S]*display: flex !important/)
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

test('image preview observer ignores unrelated workspace DOM churn', () => {
  assert.match(runtime, /const LIGHTBOX_SELECTOR = '\.image-lightbox'/)
  assert.match(runtime, /function mutationTouchesImagePreview\(record: MutationRecord\)/)
  assert.match(runtime, /target\.closest\(IMAGE_CARD_SELECTOR\)/)
  assert.match(runtime, /target\.closest\(LIGHTBOX_SELECTOR\)/)
  assert.match(runtime, /new MutationObserver\(\(records\) =>/)
  assert.match(runtime, /records\.some\(mutationTouchesImagePreview\)/)
  assert.doesNotMatch(runtime, /new MutationObserver\(queueNormalize\)/)
})

test('high-frequency image gesture listeners exist only during an active lightbox touch', () => {
  assert.match(runtime, /let gestureListenersAttached = false/)
  assert.match(runtime, /function attachGestureListeners\(\)/)
  assert.match(runtime, /document\.addEventListener\('pointermove', handlePointerMove, \{ capture: true, passive: false \}\)/)
  assert.match(runtime, /function detachGestureListeners\(\)/)
  assert.match(runtime, /touchPoints\.set\(event\.pointerId,[\s\S]*attachGestureListeners\(\)/)
  assert.match(runtime, /if \(touchPoints\.size === 0\) detachGestureListeners\(\)/)
  assert.match(runtime, /function clearTouchState\(\)[\s\S]*detachGestureListeners\(\)/)
  assert.match(
    runtime,
    /document\.addEventListener\('pointerdown', handlePointerDown, true\)\s*document\.addEventListener\('click', handleClick, true\)/,
  )
})
