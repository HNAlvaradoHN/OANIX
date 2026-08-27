import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const notes = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
const folders = readFileSync('src/features/folders/FolderMobileDragRuntime.tsx', 'utf8')
const organic = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')

test('note touch reorder snapshots rows only after leaving the current slot', () => {
  const start = notes.indexOf('const reorderTouchDomAtPoint')
  const end = notes.indexOf('const stopTouchAutoScroll', start)
  assert.ok(start >= 0 && end > start)
  const block = notes.slice(start, end)
  const noOp = block.indexOf('gesture.item.nextElementSibling === destination')
  const snapshot = block.indexOf('snapshotRects(list)')
  assert.ok(noOp >= 0 && snapshot > noOp)
  assert.doesNotMatch(block, /const beforeOrder = noteOrder/)
})

test('folder touch reorder snapshots cards only after leaving the current slot', () => {
  const start = folders.indexOf('function reorderDomAtPoint')
  const end = folders.indexOf('function scrollSpeed', start)
  assert.ok(start >= 0 && end > start)
  const block = folders.slice(start, end)
  const noOp = block.indexOf('gesture.item.nextElementSibling === insertionTarget')
  const snapshot = block.indexOf('snapshotRects(gesture.rail)')
  assert.ok(noOp >= 0 && snapshot > noOp)
  assert.doesNotMatch(block, /const beforeOrder = folderOrder/)
})

test('folder touch reorder no crea una animacion extra sobre la tarjeta sostenida por cada hueco', () => {
  const start = folders.indexOf('function reorderDomAtPoint')
  const end = folders.indexOf('function scrollSpeed', start)
  assert.ok(start >= 0 && end > start)
  const block = folders.slice(start, end)
  assert.match(block, /if \(animate && beforeRects\) animateReflow\(gesture\.rail, beforeRects, gesture\.item\)/)
  assert.doesNotMatch(block, /gesture\.item\.animate\(/)
  assert.doesNotMatch(block, /boxShadow/)
})

test('tag reorder computes a real slot change before capturing FLIP rectangles', () => {
  const start = organic.indexOf('function advanceTagDragAtX')
  const end = organic.indexOf('function handleTagPointerMove', start)
  assert.ok(start >= 0 && end > start)
  const block = organic.slice(start, end)
  const move = block.indexOf('moveTagOneStepTowardTarget')
  const noOp = block.indexOf('if (next === current) return')
  const snapshot = block.indexOf('captureTagRects(host)')
  assert.ok(move >= 0 && noOp > move && snapshot > noOp)
  assert.match(block, /tagsRef\.current = next/)
  assert.match(block, /setTags\(next\)/)
})
