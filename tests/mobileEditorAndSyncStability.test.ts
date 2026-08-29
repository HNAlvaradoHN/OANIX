import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const largePasteRuntimePath = new URL('../src/features/editor/LargePasteRuntime.tsx', import.meta.url)
const mobileEditorCssPath = new URL('../src/features/editor/mobileEditorStability.css', import.meta.url)
const autoSyncRuntimePath = new URL('../src/features/sync/AutoSyncRuntime.tsx', import.meta.url)

test('mobile large paste reconstructs a caret from the paste target when Android drops Selection', async () => {
  const source = await readFile(largePasteRuntimePath, 'utf8')

  assert.match(source, /function ensureEditorSelection\(editor: HTMLElement, target: Element\)/)
  assert.match(source, /target\.closest<HTMLElement>\('\[data-block-id\]'\)/)
  assert.match(source, /range\.selectNodeContents\(anchor\)/)
  assert.match(source, /range\.collapse\(false\)/)
  assert.match(source, /if \(!ensureEditorSelection\(editor, target\)\)/)
  assert.match(source, /shouldEncapsulateClipboardPaste\(plainText\)/)
})

test('decorative editor chrome is not included in mobile text selection and code actions use tap semantics', async () => {
  const css = await readFile(mobileEditorCssPath, 'utf8')

  assert.match(css, /\.editor-daily-entry__date-row/)
  assert.match(css, /user-select: none/)
  assert.match(css, /\.editor-code-block__toolbar button/)
  assert.match(css, /touch-action: manipulation/)
  assert.match(css, /@media \(pointer: coarse\)/)
})

test('auto sync is event driven and does not poll the complete vault every 30 seconds while idle', async () => {
  const source = await readFile(autoSyncRuntimePath, 'utf8')

  assert.match(source, /postgres_changes/)
  assert.match(source, /oanix:local-data-changed/)
  assert.match(source, /visibilitychange/)
  assert.match(source, /window\.addEventListener\('online'/)
  assert.doesNotMatch(source, /setInterval/)
  assert.doesNotMatch(source, /30_000/)
})
