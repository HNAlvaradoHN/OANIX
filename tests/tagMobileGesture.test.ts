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

test('el gesto móvil evita selección de texto y conserva swipe horizontal corto', () => {
  assert.match(css, /touch-action: none !important/)
  assert.match(css, /user-select: none !important/)
  assert.match(css, /-webkit-touch-callout: none !important/)
  assert.match(runtime, /startScrollLeft/)
  assert.match(runtime, /scroller\.scrollLeft = active\.startScrollLeft - dx/)
  assert.match(runtime, /document\.querySelector\('\.oanix-organic-tags\.is-reordering'\)/)
  assert.match(runtime, /event\.preventDefault\(\)/)
})

test('un swipe no abre accidentalmente la etiqueta y el runtime se monta desbloqueado', () => {
  assert.match(runtime, /suppressClickForId/)
  assert.match(runtime, /event\.stopImmediatePropagation\(\)/)
  assert.match(gate, /<TagMobileGestureRuntime \/>/)
})
