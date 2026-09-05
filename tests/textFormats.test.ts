import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import type { EditorSurfaceBlockChangeSet } from '../src/features/editor/editorSurfaceContract.ts'
import { applyOanixTextFormat } from '../src/features/editor/oanixTextFormatLayer.ts'
import { TEXT_BLOCK_KIND, decodeTextBlock, encodeTextBlock, type EditorTextBlock } from '../src/features/editor/textBlockCodec.ts'

function line(id: string, text: string, format: EditorTextBlock['format'] = 'paragraph'): EditorTextBlock {
  return { id, kind: TEXT_BLOCK_KIND, text, format }
}

test('legacy text blocks decode as paragraph without migration', () => {
  const block = decodeTextBlock({ id: 'legacy', kind: TEXT_BLOCK_KIND, data: { text: 'hola' } })
  assert.equal(block?.format, 'paragraph')
  assert.deepEqual(encodeTextBlock(line('p', 'hola')).data, { text: 'hola' })
})

test('plain notes can still enter the rich text document safely', async () => {
  let changes: EditorSurfaceBlockChangeSet | null = null
  let snapshotText = 'not-saved'
  const result = await applyOanixTextFormat({
    mode: 'plain',
    format: 'h2',
    title: 'Nota',
    text: 'uno\ndos\ntres',
    selectionStart: 5,
    selectionEnd: 5,
    existingBlocks: [],
    createId: (index) => `t-${index}`,
    saveBlockChanges: async (next) => { changes = next; return true },
    savePlainSnapshot: async (snapshot) => { snapshotText = snapshot.text; return true },
  })

  assert.equal(result.status, 'committed')
  assert.equal(snapshotText, '')
  assert.ok((changes?.upserts?.length ?? 0) >= 2)
})

test('live line editor owns the NotebookEditor behavior without a parallel text-line model', () => {
  const editor = readFileSync('src/features/editor/implementations/OanixTextLineEditor.tsx', 'utf8')
  const host = readFileSync('src/features/editor/EditorSurface.tsx', 'utf8')
  const runtime = readFileSync('src/features/editor/oanixTextLineRuntime.tsx', 'utf8')

  assert.equal(existsSync('src/features/editor/oanixTextLineModel.ts'), false)
  assert.equal(existsSync('src/features/editor/oanixTextBehaviorBridge.ts'), false)
  assert.equal(existsSync('src/features/editor/oanixHeadingEnterPlan.ts'), false)
  assert.equal(existsSync('tests/textBehaviorBridge.test.ts'), false)

  assert.doesNotMatch(host, /behaviorRevision|installOanixTextBehaviorBridge/)
  assert.doesNotMatch(runtime, /handleEnter|mergeWithPrevious|resetIfEmpty|applyFormat/)
  assert.doesNotMatch(editor, /useState|setLines|requestAnimationFrame/)
  assert.doesNotMatch(editor, /<textarea/)

  assert.match(editor, /document\.createElement\('div'\)/)
  assert.match(editor, /el\.contentEditable = !disabledRef\.current \? 'true' : 'false'/)
  assert.match(editor, /document\.createRange\(\)/)
  assert.match(editor, /document\.createTreeWalker\(el, NodeFilter\.SHOW_TEXT\)/)
  assert.match(editor, /lastSelectionRef/)
  assert.match(editor, /function getCurrentContext\(\)/)
  assert.match(editor, /const stored = lastSelectionRef\.current/)
  assert.match(editor, /el\.focus\(\)/)
  assert.match(editor, /scrollIntoView\(\{ block: 'nearest' \}\)/)
})

test('format behavior follows the reference applyFormat contract on the live editor', () => {
  const editor = readFileSync('src/features/editor/implementations/OanixTextLineEditor.tsx', 'utf8')

  assert.match(editor, /function applyFormat\(format: EditorTextBlockFormat\)/)
  assert.match(editor, /ctx\.hasSelection && ctx\.selectedText\.trim\(\)\.length > 0/)
  assert.match(editor, /setLineType\(ctx\.line\.id, format\)/)
  assert.match(editor, /ctx\.lineEl\.textContent\.trim\(\)\.length === 0/)
  assert.match(editor, /insertLineAfter\(ctx\.line\.id, format, ''\)/)
  assert.match(editor, /focusLine\(inserted\.id, 0\)/)
  assert.match(editor, /lastSelectionRef/)
  assert.match(editor, /activeTextLineEditorByNote/)
})

test('opening the side panel dismisses the live IME while preserving the stored formatting target', () => {
  const editor = readFileSync('src/features/editor/implementations/OanixTextLineEditor.tsx', 'utf8')

  assert.match(editor, /button\[aria-label="Más"\], \.oanix-notes__slide-handle/)
  assert.match(editor, /if \(active instanceof HTMLElement\) active\.blur\(\)/)
  assert.match(editor, /window\.getSelection\(\)\?\.removeAllRanges\(\)/)
  assert.match(editor, /const stored = lastSelectionRef\.current/)
})

test('format click closes the side panel and restores direct editing focus in the same gesture', () => {
  const editor = readFileSync('src/features/editor/implementations/OanixTextLineEditor.tsx', 'utf8')

  assert.match(editor, /root\.querySelector<HTMLButtonElement>\('\.oanix-notes__panel-close'\)\?\.click\(\)/)
  assert.match(editor, /apiRef\.current\.applyFormat\(format\)/)
  assert.match(editor, /el\.focus\(\)/)
})

test('Enter mutates the live DOM at the caret and keeps the reference focus-at-end behavior', () => {
  const editor = readFileSync('src/features/editor/implementations/OanixTextLineEditor.tsx', 'utf8')

  assert.match(editor, /function handleEnter\(\)/)
  assert.match(editor, /beforeRange\.setEnd\(range\.startContainer, range\.startOffset\)/)
  assert.match(editor, /afterRange\.setStart\(range\.endContainer, range\.endOffset\)/)
  assert.match(editor, /ctx\.lineEl\.textContent = beforeText/)
  assert.match(editor, /format: 'paragraph'/)
  assert.match(editor, /ctx\.lineEl\.after\(nextEl\)/)
  assert.match(editor, /focusLine\(next\.id\)/)
  assert.doesNotMatch(editor, /focusLine\(next\.id, 0\)/)
})

test('held Backspace keeps the same contentEditable alive across structural merges', () => {
  const editor = readFileSync('src/features/editor/implementations/OanixTextLineEditor.tsx', 'utf8')

  assert.match(editor, /if \(event\.key !== 'Backspace' \|\| event\.shiftKey\) return/)
  assert.match(editor, /ctx\.hasSelection \|\| ctx\.offset !== 0/)
  assert.match(editor, /const currentLineId = \(\) => el\.dataset\.oanixMixedTextId \?\? line\.id/)
  assert.match(editor, /handleKeyDown\(event, currentLineId\(\)\)/)
  assert.match(editor, /previousEl\.remove\(\)/)
  assert.doesNotMatch(editor, /currentEl\.remove\(\)/)
  assert.match(editor, /currentEl\.dataset\.oanixMixedTextId = previous\.id/)
  assert.match(editor, /currentEl\.textContent = merged\.text/)
  assert.match(editor, /lineRefs\.current\.set\(previous\.id, currentEl\)/)
  assert.match(editor, /placeSelection\(currentEl, caretAt\)/)
})

test('only empty H2/H3 reset to paragraph in the extended OANIX format set', () => {
  const editor = readFileSync('src/features/editor/implementations/OanixTextLineEditor.tsx', 'utf8')

  assert.match(editor, /line\.format !== 'h2' && line\.format !== 'h3'/)
  assert.match(editor, /format: 'paragraph' as const/)
})

test('paragraph is the permanent base mode and headings do not pull the next row upward', () => {
  const css = readFileSync('src/features/editor/implementations/oanixNotesSheetMobileSafeArea.css', 'utf8')

  assert.match(css, /\.oanix-notes \.oanix-notes__tool\[data-tool="paragraph"\][\s\S]*display:\s*none/)
  assert.match(css, /\.oanix-mixed-document__text\[data-oanix-text-format="paragraph"\],[\s\S]*\.oanix-notes \.oanix-notes__body/)
  assert.doesNotMatch(css, /margin-top:\s*calc\(-1 \* var\(--oanix-text-block-gap\)\)/)
  assert.doesNotMatch(css, /--oanix-text-block-gap/)
})

test('paste remains plain text and structural focus does not depend on remount timers', () => {
  const editor = readFileSync('src/features/editor/implementations/OanixTextLineEditor.tsx', 'utf8')

  assert.match(editor, /clipboardData\.getData\('text\/plain'\)/)
  assert.match(editor, /document\.createTextNode\(text\)/)
  assert.match(editor, /range\.deleteContents\(\)/)
  assert.match(editor, /range\.insertNode\(node\)/)
  assert.doesNotMatch(editor, /behaviorRevision|installOanixTextBehaviorBridge|oanixHeadingEnterPlan/)
})

test('customization closes completely and panel focus cannot consume editor writing space', () => {
  const surface = readFileSync('src/features/editor/implementations/OanixNotesSheetSurface.tsx', 'utf8')
  const css = readFileSync('src/features/editor/implementations/oanixNotesSheetMobileSafeArea.css', 'utf8')

  assert.match(surface, /function closeCustomize\(\)/)
  assert.match(surface, /active\.closest\('\.oanix-notes__customize'\)/)
  assert.match(surface, /function closeCustomizeFromPointer\(event: ReactPointerEvent<HTMLButtonElement>\)/)
  assert.match(surface, /event\.preventDefault\(\)/)
  assert.match(surface, /event\.stopPropagation\(\)/)
  assert.match(surface, /aria-label="Cerrar personalización" onPointerDown=\{closeCustomizeFromPointer\} onClick=\{closeCustomize\}/)
  assert.match(surface, /aria-label="Cerrar" onPointerDown=\{closeCustomizeFromPointer\} onClick=\{closeCustomize\}/)
  assert.match(css, /\.oanix-notes__customize\[aria-hidden="true"\][\s\S]*display:\s*none/)
  assert.match(css, /\.oanix-notes__editor-container:focus-within \.oanix-notes__body-wrap/)
  assert.doesNotMatch(css, /\.oanix-notes:focus-within \.oanix-notes__body-wrap/)
  assert.match(css, /touch-action:\s*manipulation/)
})

test('paragraph ruling keeps text cadence locked to the page line and no focus box', () => {
  const css = readFileSync('src/features/editor/implementations/oanixNotesSheetMobileSafeArea.css', 'utf8')
  assert.match(css, /--oanix-ruled-step:\s*30px/)
  assert.match(css, /--oanix-h2-ruled-step: 42px/)
  assert.match(css, /--oanix-h3-ruled-step: 36px/)
  assert.match(css, /line-height:\s*var\(--oanix-ruled-step\)/)
  assert.match(css, /line-height: var\(--oanix-h2-ruled-step\)/)
  assert.match(css, /line-height: var\(--oanix-h3-ruled-step\)/)
  assert.match(css, /background-size:\s*100% var\(--oanix-ruled-step\)/)
  assert.match(css, /repeating-linear-gradient/)
  assert.match(css, /box-shadow:\s*none/)
  assert.match(css, /border-radius:\s*0/)
})