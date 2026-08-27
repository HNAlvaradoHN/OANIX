import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/tags/TagMobileGestureRuntime.tsx', 'utf8')
const css = readFileSync('src/features/tags/tagMobileGesture.css', 'utf8')
const organic = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

test('las etiquetas conservan el reordenamiento persistente existente', () => {
  assert.match(organic, /persistTagOrder/)
  assert.match(organic, /is-reordering/)
  assert.match(organic, /setPointerCapture/)
})

test('el helper tactil no compite con el reorder de mouse en PC', () => {
  assert.match(runtime, /if \(event\.pointerType === 'mouse'\) return/)
  assert.match(runtime, /Desktop mouse reordering is owned by OrganicWorkspaceRuntime/)
})

test('el gesto móvil evita selección de texto y conserva swipe horizontal corto', () => {
  assert.match(css, /touch-action: none !important/)
  assert.match(css, /user-select: none !important/)
  assert.match(css, /-webkit-touch-callout: none !important/)
  assert.match(runtime, /startScrollLeft/)
  assert.match(runtime, /scroller\.scrollLeft = active\.startScrollLeft - dx/)
  assert.match(runtime, /document\.querySelector\('\.oanix-organic-tags\.is-reordering'\)/)
  assert.match(runtime, /event\.preventDefault\(\)/)
})

test('reorder muestra un clon fijo bajo el dedo y oculta el chip que salta en el layout', () => {
  assert.match(runtime, /cloneNode\(true\)/)
  assert.match(runtime, /oanix-tag-drag-overlay/)
  assert.match(runtime, /dragOverlay\.style\.left = `\$\{event\.clientX - dragOffsetX\}px`/)
  assert.match(runtime, /dragOverlay\.style\.top = `\$\{event\.clientY - dragOffsetY\}px`/)
  assert.match(css, /\.oanix-organic-tags\.is-reordering \.oanix-organic-tag-chip\.is-dragging[\s\S]*?opacity:\s*\.08 !important/)
  assert.match(css, /\.oanix-tag-drag-overlay[\s\S]*?position:\s*fixed !important/)
  assert.match(css, /\.oanix-tag-drag-overlay[\s\S]*?pointer-events:\s*none !important/)
})

test('reorder abre hueco también al cruzar los extremos del carril', () => {
  assert.match(organic, /function tagDropTargetAtX/)
  assert.match(organic, /clientX < candidate\.rect\.left \+ candidate\.rect\.width \/ 2/)
  assert.match(organic, /placeAfter: false/)
  assert.match(organic, /placeAfter: true/)
  assert.match(organic, /if \(next === current\) return current/)
  assert.doesNotMatch(organic, /document\.elementFromPoint\(event\.clientX, event\.clientY\)/)
})

test('reflow de etiquetas cancela la animación anterior antes de abrir el siguiente hueco', () => {
  assert.match(organic, /const tagReflowAnimations = new WeakMap<HTMLElement, Animation>/)
  assert.match(organic, /tagReflowAnimations\.get\(element\)\?\.cancel\(\)/)
  assert.match(organic, /duration: 150/)
})

test('reorder puede desplazar la tira al acercarse a los bordes sin tocar persistencia', () => {
  assert.match(runtime, /REORDER_EDGE_PX = 44/)
  assert.match(runtime, /REORDER_SCROLL_STEP_PX = 12/)
  assert.match(runtime, /autoScrollDuringReorder/)
  assert.match(runtime, /scroller\.scrollLeft -= REORDER_SCROLL_STEP_PX/)
  assert.match(runtime, /scroller\.scrollLeft \+= REORDER_SCROLL_STEP_PX/)
  assert.doesNotMatch(runtime, /persistTagOrder/)
})

test('el helper limpia overlays si la app pierde foco durante un gesto', () => {
  assert.match(runtime, /visibilitychange/)
  assert.match(runtime, /window\.addEventListener\('blur', handleBlur\)/)
  assert.match(runtime, /resetActiveGesture/)
})

test('un swipe no abre accidentalmente la etiqueta y el runtime se monta desbloqueado', () => {
  assert.match(runtime, /suppressClickForId/)
  assert.match(runtime, /event\.stopImmediatePropagation\(\)/)
  assert.match(gate, /<TagMobileGestureRuntime \/>/)
})
