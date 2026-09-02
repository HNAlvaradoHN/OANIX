import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const surface = readFileSync(
  'src/features/editor/implementations/ContinuousSheetSurface.tsx',
  'utf8',
)
const richBlocks = readFileSync(
  'src/features/editor/implementations/QwenRichBlocks.tsx',
  'utf8',
)
const registry = readFileSync(
  'src/features/editor/editorSurfaceRegistry.ts',
  'utf8',
)
const css = readFileSync(
  'src/features/editor/implementations/continuousSheetSurface.css',
  'utf8',
)

test('continuous sheet is the isolated experimental surface', () => {
  assert.match(registry, /'continuous-sheet-v1'/)
  assert.match(registry, /label: 'Hoja continua'/)
  assert.match(registry, /DEFAULT_EDITOR_SURFACE_ID: EditorSurfaceId = 'continuous-sheet-v1'/)
  assert.match(registry, /attachments: true/)
})

test('continuous sheet exposes every preserved insertion capability', () => {
  for (const kind of ['text', 'entry', 'image', 'file', 'checklist', 'contact', 'code', 'separator']) {
    assert.equal(surface.includes(`requestInsert('${kind}')`), true, `missing ${kind} insertion action`)
  }
  assert.match(surface, /index: legacySplit \? 0 : activeInsertionIndex/)
  assert.match(surface, /continuousWriting/)
  assert.match(surface, /onInsertionIndexChange=\{handleFlowInsertionIndex\}/)
})

test('continuous rich flow keeps a writing seam before and after every inserted element', () => {
  assert.match(richBlocks, /continuousWriting \? renderWritingSeam\(0\) : renderInsertPoint\(0\)/)
  assert.match(richBlocks, /renderOrderedBlock\(rawBlock, index\)/)
  assert.match(richBlocks, /continuousWriting \? renderWritingSeam\(index \+ 1\) : renderInsertPoint\(index \+ 1\)/)
  assert.match(richBlocks, /onFocus=\{\(\) => onInsertionIndexChange\?\.\(index\)\}/)
  assert.match(richBlocks, /insertWritingText\(index, event\.currentTarget\.value\)/)
})

test('external image and file insertion use the active flow index', () => {
  assert.match(richBlocks, /QwenInsertBlockKind \| 'image' \| 'file'/)
  assert.match(richBlocks, /externalInsertRequest\.index \?\? visibleBlocks\.length/)
  assert.match(richBlocks, /externalInsertRequest\.kind === 'image' \|\| externalInsertRequest\.kind === 'file'/)
  assert.match(richBlocks, /insertAttachment\(externalInsertRequest\.kind, requestedIndex\)/)
  assert.match(richBlocks, /attachmentFlow\?\.requestInsert\(kind, index\)/)
})

test('insertion from the legacy body preserves text on both sides of the cursor', () => {
  assert.match(surface, /position: body\.selectionStart \?\? body\.value\.length/)
  assert.match(surface, /before: body\.value\.slice\(0, cursor\.position\)/)
  assert.match(surface, /after: body\.value\.slice\(cursor\.position\)/)
  assert.match(surface, /legacySplit,/)
  assert.match(surface, /onExternalInsertPrepared=\{handleExternalInsertPrepared\}/)
  assert.match(surface, /if \(body\) body\.value = ''/)

  assert.match(richBlocks, /const beforeBlock = split\.before \? createTextBlock\(split\.before\) : null/)
  assert.match(richBlocks, /const afterBlock = split\.after \? createTextBlock\(split\.after\) : null/)
  assert.match(richBlocks, /if \(beforeBlock\) inserted\.push\(beforeBlock\)/)
  assert.match(richBlocks, /if \(targetBlock\) inserted\.push\(targetBlock\)/)
  assert.match(richBlocks, /if \(afterBlock\) inserted\.push\(afterBlock\)/)
  assert.match(richBlocks, /onExternalInsertPrepared\?\.\(request\.token\)/)
})

test('cursor insertion migrates surrounding text before launching an attachment picker', () => {
  assert.match(richBlocks, /const attachmentKind = request\.kind === 'image' \|\| request\.kind === 'file'/)
  assert.match(richBlocks, /const targetIndex = requestedIndex \+ \(beforeBlock \? 1 : 0\)/)
  assert.match(richBlocks, /attachmentFlow\?\.requestInsert\(request\.kind, targetIndex\)/)
  assert.match(richBlocks, /setError\('No se pudo preservar el texto alrededor de la inserción\.'\)/)
})

test('continuous surface keeps structural block controls visually hidden and mobile menus bounded', () => {
  assert.match(css, /\.oanix-continuous-sheet \.oanix-qwen-sheet__block-order \{ display: none; \}/)
  assert.match(css, /\.oanix-continuous-sheet \.oanix-continuous-seam/)
  assert.match(css, /max-height: 52dvh/)
  assert.match(css, /position: fixed/)
})

test('continuous surface preserves all four sheet designs', () => {
  for (const design of ['plain', 'ruled', 'dots', 'grid']) {
    assert.equal(surface.includes(`'${design}'`), true, `missing ${design} design`)
  }
  assert.match(css, /oanix-continuous-sheet--ruled/)
  assert.match(css, /oanix-continuous-sheet--dots/)
  assert.match(css, /oanix-continuous-sheet--grid/)
})
