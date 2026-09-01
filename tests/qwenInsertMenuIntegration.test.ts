import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const surface = readFileSync('src/features/editor/implementations/QwenSheetSurface.tsx', 'utf8')
const richBlocks = readFileSync('src/features/editor/implementations/QwenRichBlocks.tsx', 'utf8')

test('Qwen exposes one central Insertar action for supported rich blocks', () => {
  assert.match(richBlocks, />\+ Insertar</)
  assert.match(richBlocks, /insertBlock\('checklist'\)/)
  assert.match(richBlocks, /insertBlock\('code'\)/)
  assert.match(richBlocks, /role="menu"/)
  assert.match(richBlocks, /aria-label="Insertar bloque"/)
  assert.equal((surface.match(/createEditorBlockSession\(/g) ?? []).length, 1)
})

test('insertion stays in memory and reuses the existing block session', () => {
  assert.match(surface, /<QwenRichBlocks session=\{blockSession\}/)
  assert.match(richBlocks, /session\.upsert\(next\)/)
  assert.match(richBlocks, /setBlocks\(\(current\) => \[\.\.\.current, next\]\)/)
  assert.doesNotMatch(richBlocks, /setTimeout|setInterval|localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest/)
})

test('one visual controller loads rich blocks and preserves their stored sequence', () => {
  assert.equal((richBlocks.match(/session\.load\(\)/g) ?? []).length, 1)
  assert.match(richBlocks, /blocks\.map\(\(rawBlock\) =>/)
  assert.match(richBlocks, /decodeChecklistBlock\(rawBlock\)[\s\S]*decodeCodeBlock\(rawBlock\)/)
  assert.match(richBlocks, /data-oanix-rich-block-flow="ordered"/)
})
