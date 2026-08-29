import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const drag = readFileSync('src/features/notes/themes/infographic/InfographicThemeDragRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/themes/infographic/infographicTheme.css', 'utf8')
const shell = readFileSync('src/features/notes/WorkspaceV2Sidebar.tsx', 'utf8')
const theme = readFileSync('src/features/notes/themes/infographic/InfographicWorkspace.tsx', 'utf8')

test('infographic drag keeps prototype long-press ghost jiggle and edge autoscroll', () => {
  assert.match(drag, /blockOwnClick\(root/)
  assert.match(drag, /folder:\s*500/)
  assert.match(drag, /tag:\s*400/)
  assert.match(drag, /note:\s*400/)
  assert.match(drag, /cloneNode\(true\)/)
  assert.match(drag, /document\.elementFromPoint\(x, y\)/)
  assert.match(drag, /scrollLeft \+= speed/)
  assert.match(drag, /scrollTop \+= speed/)
  assert.match(drag, /setFolderJiggle\(true\)/)
  assert.match(css, /oanix-infographic-ios-jiggle/)
})

test('infographic drag installs high-frequency listeners only after pointer down', () => {
  const pointerDown = drag.indexOf('function handlePointerDown')
  const globalMove = drag.indexOf("document.addEventListener('pointermove', handlePointerMove")
  const rootListener = drag.indexOf("root.addEventListener('pointerdown', handlePointerDown")

  assert.ok(pointerDown >= 0)
  assert.ok(globalMove > pointerDown)
  assert.ok(rootListener > globalMove)
  assert.doesNotMatch(
    drag.slice(rootListener),
    /document\.addEventListener\('pointermove', handlePointerMove/,
  )
  assert.match(drag, /document\.removeEventListener\('pointermove', handlePointerMove, true\)/)
})

test('infographic note drag cannot cross pinned and unpinned groups', () => {
  assert.match(drag, /group: item\.dataset\.infographicGroup \?\? ''/)
  assert.match(drag, /target\.dataset\.infographicGroup \?\? ''\) !== gesture\.group/)
})

test('infographic drag owns coarse scrolling and momentum with one pointer-event authority', () => {
  assert.match(drag, /data-infographic-scroll-kind/)
  assert.match(drag, /gesture\.scrollContainer\.scrollTop = gesture\.startScroll - dy/)
  assert.match(drag, /gesture\.scrollContainer\.scrollLeft = gesture\.startScroll - dx/)
  assert.match(drag, /startMomentumScroll/)
  assert.match(drag, /gesture\.item\.setPointerCapture\(gesture\.pointerId\)/)
  assert.match(drag, /root\.addEventListener\('contextmenu', blockNativeLongPress, true\)/)
  assert.match(drag, /root\.addEventListener\('selectstart', blockNativeLongPress, true\)/)
  assert.doesNotMatch(drag, /TouchEvent|touchstart|touchmove|touchend/)
  assert.match(css, /@media \(hover: none\) and \(pointer: coarse\)[\s\S]*\[data-infographic-drag-kind\]\[data-infographic-id\][\s\S]*touch-action: none/)
})

test('real action controls are excluded without disabling drag from the card itself', () => {
  assert.match(drag, /data-infographic-drag-ignore="true"/)
  assert.match(drag, /if \(dragBlocked\) return/)
  assert.match(css, /\.action-icon-btn[\s\S]*touch-action: manipulation/)
})

test('infographic reorder stays disabled while bulk privacy selection is active', () => {
  assert.match(drag, /function bulkSelectionActive\(\): boolean/)
  assert.match(drag, /classList\.contains\('oanix-note-bulk-selecting'\)/)
  assert.match(drag, /bulkSelectionActive\(\)/)
  assert.match(css, /html\.oanix-note-bulk-selecting \.oanix-infographic-theme \.oanix-workspace-v2__note-actions[\s\S]*pointer-events: none/)
})

test('cancel restores draggable items before the original trailing control', () => {
  assert.match(drag, /endAnchor: Element \| null/)
  assert.match(drag, /const endAnchor = initialItems\.at\(-1\)\?\.nextElementSibling \?\? null/)
  assert.match(drag, /gesture\?\.container\.insertBefore\(item, gesture\.endAnchor\)/)
  assert.doesNotMatch(drag, /gesture\?\.container\.appendChild\(item\)/)
})


test('drag feedback callback stays stable so a toast render cannot cancel an active gesture', () => {
  assert.match(theme, /const showToast = useCallback\(/)
  assert.match(theme, /<InfographicThemeDragRuntime[\s\S]*onStatus=\{showToast\}/)
})

test('active workspace shell no longer mounts the old workspace v2 drag runtime', () => {
  assert.doesNotMatch(shell, /WorkspaceV2DragRuntime/)
  assert.match(shell, /InfographicWorkspace/)
})
