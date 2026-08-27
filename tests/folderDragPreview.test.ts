import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/folders/FolderMobileDragRuntime.tsx', 'utf8')
const styles = readFileSync('src/features/folders/folderMobileDrag.css', 'utf8')

test('folder drag keeps a lifted copy and a live in-rail drop slot', () => {
  assert.match(runtime, /createGhost\(gesture\.item\)/)
  assert.match(runtime, /grabOffsetX/)
  assert.match(runtime, /grabOffsetY/)
  assert.match(runtime, /siblings\.find/)
  assert.match(runtime, /insertBefore\(gesture\.item, insertionTarget\)/)
  assert.match(runtime, /insertBefore\(gesture\.item, endAnchor\(gesture\.rail\)\)/)
  assert.doesNotMatch(runtime, /appendChild\(gesture\.item\)/)
  assert.match(runtime, /animateReflow/)
  assert.match(runtime, /oanix:folder-order-preview/)
  assert.doesNotMatch(runtime, /persistFolderOrder/)
  assert.match(styles, /oanix-mobile-folder-drag-source[\s\S]*border:\s*2px dashed/)
  assert.match(styles, /oanix-mobile-folder-drag-source > \*[\s\S]*visibility:\s*hidden/)
  assert.match(styles, /oanix-mobile-folder-drag-ghost[\s\S]*scale\(1\.075\)/)
  assert.match(styles, /html\.oanix-v383-visual body \.oanix-folder-rail__item\.oanix-mobile-folder-drag-source[\s\S]*background:\s*rgba\(59,130,246,\.10\) !important/)
  assert.match(styles, /html\.oanix-v383-visual body \.oanix-folder-rail__item\.oanix-mobile-folder-drag-ghost[\s\S]*position:\s*fixed !important/)
})

test('edge auto-scroll continues reordering while the dragged card is held', () => {
  assert.match(runtime, /EDGE_SCROLL_PX/)
  assert.match(runtime, /scrollLeft \+= speed/)
  assert.match(runtime, /reorderDomAtPoint\(gesture\)/)
})

test('desktop mouse wheel scrolls the folder rail on its actual axis', () => {
  assert.match(runtime, /const onWheel = \(event: WheelEvent\)/)
  assert.match(runtime, /target\.closest<HTMLElement>\('\.oanix-folder-rail__scroll'\)/)
  assert.match(runtime, /const canScrollVertically = rail\.scrollHeight > rail\.clientHeight \+ 1/)
  assert.match(runtime, /rail\.scrollTop \+= event\.deltaY/)
  assert.match(runtime, /const canScrollHorizontally = rail\.scrollWidth > rail\.clientWidth \+ 1/)
  assert.match(runtime, /rail\.scrollLeft \+= delta/)
  assert.match(runtime, /document\.addEventListener\('wheel', onWheel, \{ capture: true, passive: false \}\)/)
})
