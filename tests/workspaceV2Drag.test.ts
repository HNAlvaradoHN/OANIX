import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const drag = readFileSync('src/features/notes/WorkspaceV2DragRuntime.tsx', 'utf8')

test('workspace v2 drag keeps the proven long-press ghost and edge-autoscroll model', () => {
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
