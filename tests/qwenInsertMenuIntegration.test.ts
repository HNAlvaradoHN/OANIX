import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const surface = readFileSync('src/features/editor/implementations/QwenSheetSurface.tsx', 'utf8')
const richBlocks = readFileSync('src/features/editor/implementations/QwenRichBlocks.tsx', 'utf8')
const session = readFileSync('src/features/editor/editorBlockSession.ts', 'utf8')

test('Qwen exposes Insertar at real positions in the ordered rich flow', () => {
  assert.match(richBlocks, />\s*\+ Insertar\s*</)
  assert.match(richBlocks, /renderInsertPoint\(0\)/)
  assert.match(richBlocks, /renderInsertPoint\(index \+ 1\)/)
  assert.match(richBlocks, /insertBlock\('checklist', index\)/)
  assert.match(richBlocks, /insertBlock\('code', index\)/)
  assert.match(richBlocks, /role="menu"/)
  assert.match(richBlocks, /aria-label="Insertar bloque"/)
  assert.equal((surface.match(/createEditorBlockSession\(/g) ?? []).length, 1)
})

test('positional insertion is one in-memory buffer mutation before the shared checkpoint', () => {
  assert.match(richBlocks, /session\.insert\(next, index\)/)
  assert.match(session, /insert\(block, index\)/)
  assert.doesNotMatch(richBlocks, /session\.reorder\(/)
  assert.doesNotMatch(richBlocks, /setTimeout|setInterval|localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest/)
})

test('one visual controller loads rich blocks once and preserves unknown positions', () => {
  assert.equal((richBlocks.match(/session\.load\(\)/g) ?? []).length, 1)
  assert.match(richBlocks, /blocks\.map\(\(rawBlock, index\) =>/)
  assert.match(richBlocks, /decodeChecklistBlock\(rawBlock\)[\s\S]*decodeCodeBlock\(rawBlock\)/)
  assert.match(richBlocks, /data-oanix-unknown-block-kind=\{rawBlock\.kind\}/)
  assert.match(richBlocks, /data-oanix-rich-block-flow="ordered"/)
})

test('legacy body is explicitly represented as the compatibility text segment before rich flow', () => {
  assert.match(surface, /data-oanix-flow-segment="legacy-text"/)
  assert.match(surface, /<textarea[\s\S]*ref=\{bodyRef\}/)
  assert.match(richBlocks, /data-oanix-flow-anchor="after-legacy-text"/)
  assert.doesNotMatch(surface, /encodeChecklistBlock|encodeCodeBlock/)
})
