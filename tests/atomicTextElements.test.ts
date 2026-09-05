import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('quote list and numbered list render as atomic managed elements', () => {
  const editor = readFileSync('src/features/editor/implementations/OanixTextLineEditor.tsx', 'utf8')
  const css = readFileSync('src/features/editor/implementations/oanixTextLineEditor.css', 'utf8')
  const mobileCss = readFileSync('src/features/editor/implementations/oanixNotesSheetMobileSafeArea.css', 'utf8')

  assert.match(editor, /const ATOMIC_TEXT_FORMATS = new Set<EditorTextBlockFormat>/)
  assert.match(editor, /'quote'/)
  assert.match(editor, /'list'/)
  assert.match(editor, /'numbered-list'/)
  assert.match(editor, /function buildAtomicLineEl\(line: LineData\)/)
  assert.match(editor, /root\.dataset\.oanixElementId = line\.id/)
  assert.match(editor, /root\.dataset\.oanixElementKind = format/)
  assert.match(css, /\.oanix-text-atomic--quote/)
  assert.match(css, /\.oanix-text-atomic__items/)

  assert.doesNotMatch(mobileCss, /oanix-mixed-document__text\[data-oanix-text-format="quote"\]/)
  assert.doesNotMatch(mobileCss, /oanix-mixed-document__text\[data-oanix-text-format="list"\]/)
  assert.doesNotMatch(mobileCss, /oanix-mixed-document__text\[data-oanix-text-format="numbered-list"\]/)
})

test('list elements own their add/remove interaction instead of using text-line Enter', () => {
  const editor = readFileSync('src/features/editor/implementations/OanixTextLineEditor.tsx', 'utf8')

  assert.match(editor, /items\.splice\(index \+ 1, 0, ''\)/)
  assert.match(editor, /items\.push\(''\)/)
  assert.match(editor, /'＋ Añadir elemento'/)
  assert.match(editor, /'＋ Añadir número'/)
  assert.match(editor, /className = 'oanix-text-atomic__remove'/)
})

test('atomic elements always keep a writable empty paragraph above and below', () => {
  const editor = readFileSync('src/features/editor/implementations/OanixTextLineEditor.tsx', 'utf8')

  assert.match(editor, /function isEmptyParagraph\(line: LineData \| undefined\)/)
  assert.match(editor, /function withAtomicParagraphBoundaries\(source: readonly LineData\[\]\)/)
  assert.match(editor, /function ensureAtomicParagraphBoundaries\(lineId: string\)/)
  assert.match(editor, /insertLineBefore\(lineId, 'paragraph', ''\)/)
  assert.match(editor, /insertLineAfter\(lineId, 'paragraph', ''\)/)
  assert.match(editor, /const normalized = withAtomicParagraphBoundaries\(initial\)/)
  assert.match(editor, /enqueueSegmentOrderSave\(initial, normalized\.lines, normalized\.added\)/)
})

test('atomic block delete removes only the managed block and leaves surrounding writing rows', () => {
  const editor = readFileSync('src/features/editor/implementations/OanixTextLineEditor.tsx', 'utf8')
  const css = readFileSync('src/features/editor/implementations/oanixTextLineEditor.css', 'utf8')

  assert.match(editor, /deleteBlock\.textContent = 'Eliminar bloque'/)
  assert.match(editor, /function removeAtomicBlock\(lineId: string\)/)
  assert.match(editor, /linesRef\.current = linesRef\.current\.filter\(\(item\) => item\.id !== lineId\)/)
  assert.match(editor, /enqueueSegmentOrderSave\(previous, next, changed, \[lineId\]\)/)
  assert.match(editor, /if \(target && !isAtomicTextFormat\(target\.format\)\) focusLine\(target\.id, 0\)/)
  assert.match(css, /\.oanix-text-atomic__delete-block/)
})

test('sequential paragraph Backspace stops at atomic text elements', () => {
  const editor = readFileSync('src/features/editor/implementations/OanixTextLineEditor.tsx', 'utf8')

  assert.match(editor, /if \(previous && isAtomicTextFormat\(previous\.format\)\) \{[\s\S]*event\.preventDefault\(\)[\s\S]*return/)
  assert.match(editor, /if \(isAtomicTextFormat\(current\.format\) \|\| isAtomicTextFormat\(previous\.format\)\) return/)
  assert.match(editor, /if \(!line \|\| isAtomicTextFormat\(line\.format\)\) return/)
})

test('atomic focus clears stale paragraph selection so menu actions cannot target old text', () => {
  const editor = readFileSync('src/features/editor/implementations/OanixTextLineEditor.tsx', 'utf8')

  assert.match(editor, /function clearStoredTextTarget\(\)/)
  assert.match(editor, /lastSelectionRef\.current = null/)
  assert.match(editor, /window\.getSelection\(\)\?\.removeAllRanges\(\)/)
  assert.match(editor, /input\.addEventListener\('focus', handleAtomicFocus\)/)
})
