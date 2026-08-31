import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const editor = readFileSync('src/features/editor/NoteEditor.tsx', 'utf8')
const structure = readFileSync('src/features/editor/noteEditor.css', 'utf8')
const sheet = readFileSync('src/features/editor/sheets/ruledSheet.css', 'utf8')

test('ruled sheet keeps the historically validated 32px baseline contract in one replaceable layer', () => {
  assert.match(sheet, /--oanix-sheet-row: 32px/)
  assert.match(sheet, /--oanix-sheet-baseline-offset: 17px/)
  assert.match(sheet, /--oanix-sheet-content-inset: 24px/)
  assert.match(sheet, /line-height: var\(--oanix-sheet-row\)/)
  assert.match(sheet, /background-position: 0 var\(--oanix-sheet-baseline-offset\)/)
  assert.match(sheet, /background-size: 100% var\(--oanix-sheet-row\)/)
  assert.match(sheet, /background-attachment: local/)
  assert.match(sheet, /b5c5dd5/)
})

test('sheet presentation is isolated from editor structure and storage concerns', () => {
  assert.match(editor, /data-oanix-sheet="ruled-v1"/)
  assert.match(editor, /import '\.\/sheets\/ruledSheet\.css'/)
  assert.doesNotMatch(sheet, /IndexedDB|encrypt|sync|saveRebuildNote|note\.v2/)
  assert.doesNotMatch(structure, /repeating-linear-gradient|--oanix-sheet-row|--oanix-sheet-baseline-offset/)
})

test('typing path does not mirror a large note into React state', () => {
  assert.match(editor, /useRef<HTMLTextAreaElement/)
  assert.match(editor, /defaultValue=\{initialText\}/)
  assert.match(editor, /onInput=\{markActivity\}/)
  assert.match(editor, /if \(dirtyRef\.current\) return/)
  assert.match(editor, /textRef\.current\?\.value \?\? initialText/)
  assert.doesNotMatch(editor, /useState\(initialText|setText\(|onChange=.*text/)
  assert.doesNotMatch(editor, /innerHTML|querySelectorAll|MutationObserver|parseEditorBlocks/)
})

test('editor covers desktop mobile day and night without a second implementation', () => {
  assert.match(sheet, /data-oanix-theme-mode='light'/)
  assert.match(sheet, /@media \(max-width: 760px\)/)
  assert.match(structure, /env\(safe-area-inset-top\)/)
  assert.match(structure, /env\(safe-area-inset-bottom\)/)
  assert.doesNotMatch(editor, /isAndroid|Capacitor|navigator\.userAgent/)
})

test('superseded editor implementation is absent from the active tree', () => {
  for (const path of [
    'src/features/editor/RichTextEditor.tsx',
    'src/features/editor/CodeBlockEditor.tsx',
    'src/features/editor/EditorOperationRuntime.tsx',
    'src/features/editor/LargePasteRuntime.tsx',
    'src/features/editor/CodeBlockExportRuntime.tsx',
    'src/features/editor/editor.css',
    'src/features/editor/mobileEditorStability.css',
  ]) {
    assert.equal(existsSync(path), false, path + ' should have been removed')
  }
})
