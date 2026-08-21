import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/folders/folderNavigationRuntime.ts', 'utf8')
const motionCss = readFileSync('src/features/folders/folderMotion.css', 'utf8')
const androidBackRuntime = readFileSync('src/platform/android/AndroidBackRuntime.tsx', 'utf8')

test('las carpetas forman un nivel real del historial antes de la lista', () => {
  assert.match(runtime, /oanixFolderView/)
  assert.match(runtime, /replaceState\(\{ \.\.\.initialState, oanixFolderView: 'home' \}/)
  assert.match(runtime, /pushState\(\{ \.\.\.currentHistoryState\(\), oanixFolderView: 'list' \}/)
  assert.match(runtime, /window\.addEventListener\('popstate'/)
  assert.match(runtime, /data-oanix-folder-home-back/)
})

test('el botón de volver a carpetas usa history.back cuando viene de la lista', () => {
  assert.match(runtime, /if \(view === 'list'\)/)
  assert.match(runtime, /window\.history\.back\(\)/)
  assert.match(runtime, /event\.preventDefault\(\)/)
  assert.match(runtime, /event\.stopPropagation\(\)/)
})

test('la respuesta visual sigue puntero y tacto sin bloquear gestos', () => {
  assert.match(runtime, /pointerdown/)
  assert.match(runtime, /pointermove/)
  assert.match(runtime, /pointerup/)
  assert.match(runtime, /--oanix-folder-pointer-x/)
  assert.match(runtime, /--oanix-folder-rotate-x/)

  const moveHandler = runtime.match(/function handlePointerMove\(event: PointerEvent\) \{([\s\S]*?)\n    \}/)?.[1] ?? ''
  assert.ok(moveHandler)
  assert.doesNotMatch(moveHandler, /preventDefault\(\)/)
})

test('las tarjetas usan profundidad, barrido cobre-plata y respetan movimiento reducido', () => {
  assert.match(motionCss, /perspective\(520px\)/)
  assert.match(motionCss, /#b87333/)
  assert.match(motionCss, /oanix-folder-vault-scan/)
  assert.match(motionCss, /prefers-reduced-motion: reduce/)
})

test('el runtime compartido se monta también en PWA desde el runtime ya global', () => {
  assert.match(androidBackRuntime, /useFolderNavigationRuntime/)
  assert.match(androidBackRuntime, /useFolderNavigationRuntime\(\)/)
  assert.match(androidBackRuntime, /if \(!isAndroidBackRuntime\(\) \|\| !exitPromptVisible\) return null/)
})
