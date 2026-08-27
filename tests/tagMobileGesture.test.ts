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
  assert.match(runtime, /geometry\.controlsLeft - REORDER_RIGHT_GUARD_PX - dragOverlayWidth/)
  assert.match(runtime, /dragOverlay\.style\.left = `\$\{clampedLeft\}px`/)
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
  assert.match(organic, /function clampTagDragX/)
  assert.match(organic, /Math\.min\(clientX, controlsLeft - 1\)/)
  assert.match(organic, /if \(next === current\) return current/)
  assert.doesNotMatch(organic, /document\.elementFromPoint\(event\.clientX, event\.clientY\)/)
})

test('un gesto rápido cruza etiquetas de un hueco por actualización', () => {
  assert.match(organic, /function moveTagOneStepTowardTarget/)
  assert.match(organic, /const desired = moveTagAroundTarget/)
  assert.match(organic, /const direction = desiredIndex > currentIndex \? 1 : -1/)
  assert.match(organic, /currentIndex \+ direction/)
  assert.match(organic, /moveTagOneStepTowardTarget\(current, draggedId, dropTarget\.targetId, dropTarget\.placeAfter\)/)
})

test('reflow de etiquetas cancela la animación anterior antes de abrir el siguiente hueco', () => {
  assert.match(organic, /const tagReflowAnimations = new WeakMap<HTMLElement, Animation>/)
  assert.match(organic, /tagReflowAnimations\.get\(element\)\?\.cancel\(\)/)
  assert.match(organic, /duration: 150/)
})

test('reorder desplaza la tira de forma pautada al acercarse a los bordes', () => {
  assert.match(runtime, /REORDER_EDGE_PX = 64/)
  assert.match(runtime, /REORDER_MAX_SCROLL_PX = 3/)
  assert.match(runtime, /REORDER_RIGHT_GUARD_PX = 8/)
  assert.match(runtime, /REORDER_SLOT_TICK_MS = 85/)
  assert.match(runtime, /scheduleAutoScrollDuringReorder/)
  assert.match(runtime, /const tick = \(now: number\)/)
  assert.match(runtime, /autoScrollFrame = window\.requestAnimationFrame\(tick\)/)
  assert.match(runtime, /latestReorderPointerX = Math\.min\(pointerX, geometry\.controlsLeft - REORDER_RIGHT_GUARD_PX\)/)
  assert.match(runtime, /window\.dispatchEvent\(new CustomEvent\('oanix:tag-reorder-edge-tick'/)
  assert.match(runtime, /lastEdgeSlotTickAt/)
  assert.doesNotMatch(runtime, /REORDER_SCROLL_STEP_PX = 12/)
  assert.doesNotMatch(runtime, /persistTagOrder/)
})

test('reorder tactil mide la geometria una vez por gesto y no fuerza layout en cada frame', () => {
  assert.match(runtime, /let reorderGeometry: \{ controlsLeft: number; scrollerLeft: number; scrollerRight: number \} \| null = null/)
  assert.match(runtime, /function geometryForReorder\(scroller: HTMLElement\)/)
  assert.match(runtime, /if \(reorderGeometry\) return reorderGeometry/)
  assert.match(runtime, /dragOverlayWidth = rect\.width/)
  assert.doesNotMatch(runtime, /dragOverlay\.getBoundingClientRect\(\)\.width/)
  assert.match(runtime, /reorderGeometry = null/)
  const tickStart = runtime.indexOf('const tick = (now: number)')
  const tickEnd = runtime.indexOf('autoScrollFrame = window.requestAnimationFrame(tick)', tickStart)
  assert.ok(tickStart >= 0 && tickEnd > tickStart)
  assert.doesNotMatch(runtime.slice(tickStart, tickEnd), /getBoundingClientRect/)
})

test('el borde derecho sigue avanzando huecos aunque el dedo quede quieto', () => {
  assert.match(runtime, /if \(delta === 0\) return/)
  assert.match(runtime, /window\.dispatchEvent\(new CustomEvent\('oanix:tag-reorder-edge-tick'/)
  assert.match(runtime, /autoScrollFrame = window\.requestAnimationFrame\(tick\)/)
  assert.match(organic, /window\.addEventListener\('oanix:tag-reorder-edge-tick'/)
  assert.match(organic, /advanceTagDragAtX\(draggedId, detail\.clientX\)/)
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
