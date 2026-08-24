import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/folders/FolderMobileDragRuntime.tsx', 'utf8')

test('fast movement at the long-press threshold starts drag instead of cancelling it', () => {
  assert.match(runtime, /PRESS_ARM_GRACE_MS/)
  assert.match(runtime, /pressedAt:\s*performance\.now\(\)/)
  assert.match(runtime, /heldFor >= LONG_PRESS_MS - PRESS_ARM_GRACE_MS/)
  assert.match(runtime, /beginDrag\(\)/)
})

test('edge scrolling keeps placement live without reflow animation on every frame', () => {
  assert.match(runtime, /reorderDomAtPoint\(gesture, false\)/)
  assert.match(runtime, /MAX_SCROLL_PER_FRAME = 9/)
})
