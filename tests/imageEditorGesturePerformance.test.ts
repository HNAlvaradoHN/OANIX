import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const editor = readFileSync('src/features/images/ImageNoteEditor.tsx', 'utf8')

test('image editor high-frequency pointer listeners exist only during drag or resize', () => {
  assert.match(editor, /let gestureListenersAttached = false/)
  assert.match(editor, /function attachGestureListeners\(\)/)
  assert.match(editor, /document\.addEventListener\('pointermove', handlePointerMove, true\)/)
  assert.match(editor, /function detachGestureListeners\(\)/)
  assert.match(editor, /imageDragState = \{[\s\S]*dragging: false,[\s\S]*\}\s*attachGestureListeners\(\)/)
  assert.match(editor, /resizeState = \{[\s\S]*direction: handle\.dataset\.imageResize \?\? 'se',[\s\S]*\}\s*attachGestureListeners\(\)/)
  assert.match(editor, /imageDragState = null[\s\S]*detachGestureListeners\(\)/)
  assert.match(editor, /resizeState = null\s*emitEditorInput\(root\)\s*detachGestureListeners\(\)/)
  assert.match(
    editor,
    /root\.addEventListener\('paste', handlePaste, true\)\s*document\.addEventListener\('keydown', handleKeyDown\)/,
  )
})

test('image hydration observer ignores unrelated editor DOM churn', () => {
  assert.match(editor, /function elementTouchesStoredImage\(element: Element\)/)
  assert.match(editor, /imagesRef\.current\.has\(directBlockId\)/)
  assert.match(editor, /function mutationTouchesImageEditorStructure\(record: MutationRecord\)/)
  assert.match(editor, /node\.matches\('\.editor-toolbar, \.editor-surface'\)/)
  assert.match(editor, /records\.some\(mutationTouchesImageEditorStructure\)/)
  assert.doesNotMatch(editor, /new MutationObserver\(\(\) => \{\s*\/\/ Hydration mutates image controls/)
})
