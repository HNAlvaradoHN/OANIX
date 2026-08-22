import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/folders/folderNavigationRuntime.ts', 'utf8')
const main = readFileSync('src/main.tsx', 'utf8')
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

test('la navegación ya no impone respuesta visual de puntero ni transformaciones 3D', () => {
  assert.doesNotMatch(runtime, /pointerdown|pointermove|pointerup/)
  assert.doesNotMatch(runtime, /--oanix-folder-pointer-x|--oanix-folder-rotate-x/)
  assert.doesNotMatch(runtime, /folderMotion\.css/)
})

test('las capas visuales heredadas de movimiento y slider quedan fuera del código activo', () => {
  assert.equal(existsSync('src/features/folders/folderMotion.css'), false)
  assert.equal(existsSync('src/features/folders/folderKineticSlide.css'), false)
  assert.equal(existsSync('src/features/folders/FolderKineticSlideRuntime.tsx'), false)
  assert.doesNotMatch(main, /FolderKineticSlideRuntime/)
})

test('el runtime compartido conserva solo historial y se monta también en PWA desde el runtime ya global', () => {
  assert.match(androidBackRuntime, /useFolderNavigationRuntime/)
  assert.match(androidBackRuntime, /useFolderNavigationRuntime\(\)/)
  assert.match(androidBackRuntime, /if \(!isAndroidBackRuntime\(\) \|\| !exitPromptVisible\) return null/)
})
