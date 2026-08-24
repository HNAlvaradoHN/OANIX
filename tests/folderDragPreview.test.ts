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
  assert.match(runtime, /appendChild\(gesture\.item\)/)
  assert.match(runtime, /animateReflow/)
  assert.match(runtime, /persistFolderOrder\(nextOrder\)/)
  assert.match(styles, /oanix-mobile-folder-drag-source[\s\S]*border:\s*2px dashed/)
  assert.match(styles, /oanix-mobile-folder-drag-source > \*[\s\S]*visibility:\s*hidden/)
  assert.match(styles, /oanix-mobile-folder-drag-ghost[\s\S]*scale\(1\.075\)/)
})

test('edge auto-scroll continues reordering while the dragged card is held', () => {
  assert.match(runtime, /EDGE_SCROLL_PX/)
  assert.match(runtime, /scrollLeft \+= speed/)
  assert.match(runtime, /reorderDomAtPoint\(gesture\)/)
})
