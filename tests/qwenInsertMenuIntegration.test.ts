import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const surface = readFileSync('src/features/editor/implementations/QwenSheetSurface.tsx', 'utf8')
const richBlocks = readFileSync('src/features/editor/implementations/QwenRichBlocks.tsx', 'utf8')
const session = readFileSync('src/features/editor/editorBlockSession.ts', 'utf8')

function functionSlice(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start)
  assert.notEqual(start, -1, `Missing ${startMarker}`)
  assert.notEqual(end, -1, `Missing ${endMarker}`)
  return source.slice(start, end)
}

test('Qwen exposes Insertar at real positions in the ordered rich flow', () => {
  assert.match(richBlocks, />\s*\+ Insertar\s*</)
  assert.match(richBlocks, /renderInsertPoint\(0\)/)
  assert.match(richBlocks, /renderInsertPoint\(index \+ 1\)/)
  assert.match(richBlocks, /insertBlock\('text', index\)/)
  assert.match(richBlocks, /insertBlock\('checklist', index\)/)
  assert.match(richBlocks, /insertBlock\('code', index\)/)
  assert.match(richBlocks, /role="menu"/)
  assert.match(richBlocks, /aria-label="Insertar bloque"/)
  assert.equal((surface.match(/createEditorBlockSession\(/g) ?? []).length, 1)
})

test('positional insertion translates visual positions without turning hidden metadata into slots', () => {
  const insertPath = functionSlice(richBlocks, 'function insertBlock(', 'function insertAttachment(')

  assert.match(insertPath, /replicaFlowIndexToOrderIndex\(blocks, index\)/)
  assert.match(insertPath, /session\.insert\(nextBlock, rawIndex\)/)
  assert.match(insertPath, /\.\.\.presentationBlocks/)
  assert.match(session, /insert\(block, index\)/)
  assert.doesNotMatch(insertPath, /session\.reorder\(/)
  assert.doesNotMatch(richBlocks, /setTimeout|setInterval|localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest/)
})

test('rich block state reloads only for initial load or an explicit attachment-flow revision', () => {
  assert.equal((richBlocks.match(/session\.load\(\)/g) ?? []).length, 2)
  assert.match(richBlocks, /attachmentRevision/)
  assert.match(richBlocks, /splitReplicaEditorBlocks\(blocks\)/)
  assert.match(richBlocks, /visibleBlocks\.map\(\(rawBlock, index\) =>/)
  assert.match(richBlocks, /decodeTextBlock\(rawBlock\)[\s\S]*decodeChecklistBlock\(rawBlock\)[\s\S]*decodeCodeBlock\(rawBlock\)/)
  assert.match(richBlocks, /data-oanix-unknown-block-kind=\{rawBlock\.kind\}/)
  assert.match(richBlocks, /data-oanix-rich-block-flow="ordered"/)
})

test('legacy body remains a compatibility segment before the incremental rich flow', () => {
  assert.match(surface, /data-oanix-flow-segment="legacy-text"/)
  assert.match(surface, /<textarea[\s\S]*ref=\{bodyRef\}/)
  assert.match(richBlocks, /data-oanix-flow-anchor="after-legacy-text"/)
  assert.doesNotMatch(surface, /encodeTextBlock|encodeChecklistBlock|encodeCodeBlock/)
})
