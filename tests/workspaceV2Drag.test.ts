import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const drag = readFileSync('src/features/notes/WorkspaceV2DragRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/workspaceV2.css', 'utf8')

test('workspace v2 drag keeps the proven long-press ghost and edge-autoscroll model', () => {
  assert.match(drag, /performance\.now\(\) \+ 520/)
  assert.match(drag, /folder:\s*500/)
  assert.match(drag, /tag:\s*400/)
  assert.match(drag, /note:\s*400/)
  assert.match(drag, /cloneNode\(true\)/)
  assert.match(drag, /document\.elementFromPoint\(x, y\)/)
  assert.match(drag, /scrollLeft \+= speed/)
  assert.match(drag, /scrollTop \+= speed/)
  assert.match(drag, /requestAnimationFrame\(tick\)/)
})

test('workspace v2 drag installs high-frequency document listeners only after pointer down', () => {
  const pointerDown = drag.indexOf('function handlePointerDown')
  const globalMove = drag.indexOf("document.addEventListener('pointermove', handlePointerMove")
  const rootListener = drag.indexOf("activeRoot.addEventListener('pointerdown', handlePointerDown")

  assert.ok(pointerDown >= 0)
  assert.ok(globalMove > pointerDown)
  assert.ok(rootListener > globalMove)
  assert.doesNotMatch(
    drag.slice(rootListener),
    /document\.addEventListener\('pointermove', handlePointerMove/,
  )
  assert.match(drag, /document\.removeEventListener\('pointermove', handlePointerMove, true\)/)
})

test('workspace v2 note drag cannot cross pinned and unpinned groups', () => {
  assert.match(drag, /group: item\.dataset\.v2Group \?\? ''/)
  assert.match(drag, /target\.dataset\.v2Group \?\? ''\) !== gesture\.group/)
})

test('workspace v2 drag owns coarse-pointer scrolling without native gesture cancellation', () => {
  assert.match(drag, /gesture\.container\.scrollTop = gesture\.startScroll - dy/)
  assert.match(drag, /gesture\.container\.scrollLeft = gesture\.startScroll - dx/)
  assert.match(drag, /gesture\.item\.setPointerCapture\(gesture\.pointerId\)/)
  assert.match(drag, /activeRoot\.addEventListener\('contextmenu', blockNativeLongPress, true\)/)
  assert.match(drag, /activeRoot\.addEventListener\('selectstart', blockNativeLongPress, true\)/)
  assert.match(drag, /document\.addEventListener\('visibilitychange', handleVisibilityChange\)/)
  assert.match(drag, /window\.addEventListener\('blur', handleBlur\)/)
  assert.match(css, /@media \(pointer: coarse\) \{[\s\S]*\[data-v2-drag-kind\]\[data-v2-id\][\s\S]*touch-action: none/)
})

test('workspace v2 action buttons can still scroll on touch without arming a drag', () => {
  assert.match(drag, /const dragBlocked = bulkSelectionActive\(\) \|\| Boolean/)
  assert.match(drag, /if \(dragBlocked && event\.pointerType === 'mouse'\) return/)
  assert.match(drag, /if \(!dragBlocked\) \{[\s\S]*window\.setTimeout\(beginDrag, LONG_PRESS_MS\[kind\]\)/)
})

test('workspace v2 reorder stays disabled while multi-select is active', () => {
  assert.match(drag, /function bulkSelectionActive\(\): boolean/)
  assert.match(drag, /classList\.contains\('oanix-note-bulk-selecting'\)/)
  assert.match(drag, /gesture\.dragBlocked \|\| bulkSelectionActive\(\)/)
  assert.match(drag, /const dragBlocked = bulkSelectionActive\(\) \|\| Boolean/)
  assert.match(css, /html\.oanix-note-bulk-selecting \.oanix-workspace-v2__note-actions[\s\S]*pointer-events: none/)
})

test('workspace v2 cancel restores draggable items before the original trailing control', () => {
  assert.match(drag, /endAnchor: Element \| null/)
  assert.match(drag, /const endAnchor = initialItems\.at\(-1\)\?\.nextElementSibling \?\? null/)
  assert.match(drag, /gesture\?\.container\.insertBefore\(item, gesture\.endAnchor\)/)
  assert.doesNotMatch(drag, /gesture\?\.container\.appendChild\(item\)/)
})
