import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/folders/FolderMobileDragRuntime.tsx', 'utf8')

test('folder drag uses the same fast arming window as the proven note drag', () => {
  assert.match(runtime, /const LONG_PRESS_MS = 220/)
  assert.match(runtime, /const PRESS_ARM_GRACE_MS = 35/)
  assert.match(runtime, /pressedAt:\s*performance\.now\(\)/)
  assert.match(runtime, /heldFor >= LONG_PRESS_MS - PRESS_ARM_GRACE_MS/)
  assert.match(runtime, /beginDrag\(\)/)
})

test('active folder drag owns pointer movement until release', () => {
  assert.match(runtime, /gesture\.dragging = true/)
  assert.match(runtime, /setPointerCapture\(gesture\.pointerId\)/)
  assert.match(runtime, /if \(!gesture\.dragging\)[\s\S]*return[\s\S]*event\.preventDefault\(\)[\s\S]*positionGhost\(gesture\)[\s\S]*reorderDomAtPoint\(gesture\)/)
  assert.match(runtime, /document\.addEventListener\('pointerup', persistAndFinish, true\)/)
  assert.match(runtime, /document\.addEventListener\('pointercancel', cancelGesture, true\)/)
})

test('edge scrolling keeps placement live with the faster reflow budget', () => {
  assert.match(runtime, /reorderDomAtPoint\(gesture, false\)/)
  assert.match(runtime, /MAX_SCROLL_PER_FRAME = 10/)
  assert.match(runtime, /REFLOW_MS = 120/)
})
