import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const editor = readFileSync('src/features/editor/RichTextEditor.tsx', 'utf8')

test('empty-editor recovery watches only direct child replacement', () => {
  assert.match(editor, /const observer = new MutationObserver\(\(\) =>/)
  assert.match(editor, /editor\.innerHTML !== ''/)
  assert.match(editor, /observer\.observe\(editor, \{\s*childList: true,\s*\}\)/)
  assert.doesNotMatch(editor, /observer\.observe\(editor, \{[\s\S]*subtree: true/)
  assert.doesNotMatch(editor, /observer\.observe\(editor, \{[\s\S]*characterData: true/)
})
