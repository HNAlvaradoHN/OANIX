import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const runtimePath = new URL('../src/features/images/DesktopImageViewportRuntime.tsx', import.meta.url)
const mainPath = new URL('../src/main.tsx', import.meta.url)

test('desktop image viewport uses wheel zoom and middle-button pan only for mouse pointers', async () => {
  const source = await readFile(runtimePath, 'utf8')

  assert.match(source, /event\.pointerType !== 'mouse'/)
  assert.match(source, /event\.button !== MIDDLE_BUTTON/)
  assert.match(source, /document\.addEventListener\('wheel', handleWheel/)
  assert.match(source, /Math\.exp\(-normalizedDelta \* 0\.0015\)/)
  assert.match(source, /scrollLeft = state\.startScrollLeft - deltaX/)
  assert.match(source, /scrollTop = state\.startScrollTop - deltaY/)
  assert.match(source, /state\.startScale > 1 \? 1 : 2/)
})

test('desktop double-click suppression is mouse-scoped and touch handlers are not replaced', async () => {
  const source = await readFile(runtimePath, 'utf8')

  assert.match(source, /lastPointerType !== 'mouse'/)
  assert.match(source, /document\.addEventListener\('dblclick', handleDoubleClick, true\)/)
  assert.doesNotMatch(source, /pointerType === 'touch'/)
  assert.doesNotMatch(source, /touchstart|touchmove|touchend/)
})

test('desktop image viewport runtime is mounted alongside the existing PWA image runtime', async () => {
  const source = await readFile(mainPath, 'utf8')

  assert.match(source, /<PwaImagePreviewRuntime \/>/)
  assert.match(source, /<DesktopImageViewportRuntime \/>/)
})
