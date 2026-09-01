import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const surface = readFileSync('src/features/editor/implementations/QwenSheetSurface.tsx', 'utf8')
const codeBlocks = readFileSync('src/features/editor/implementations/QwenCodeBlocks.tsx', 'utf8')
const codec = readFileSync('src/features/editor/codeBlockCodec.ts', 'utf8')

test('Qwen mounts code blocks on the same rich block session as checklist', () => {
  assert.match(surface, /<QwenChecklistBlocks[\s\S]*session=\{blockSession\}/)
  assert.match(surface, /<QwenCodeBlocks[\s\S]*session=\{blockSession\}/)
  assert.equal((surface.match(/createEditorBlockSession\(/g) ?? []).length, 1)
})

test('code block UI buffers mutations through the editor session only', () => {
  assert.match(codeBlocks, /session\.load\(\)/)
  assert.match(codeBlocks, /session\.upsert\(encodeCodeBlock\(next\)\)/)
  assert.match(codeBlocks, /session\.remove\(blockId\)/)
  assert.doesNotMatch(codeBlocks, /indexedDB|localStorage|sessionStorage|fetch\(|XMLHttpRequest/)
  assert.doesNotMatch(codeBlocks, /setTimeout|setInterval/)
})

test('code blocks remain plain persisted text without runtime highlighting dependencies', () => {
  assert.match(codec, /CODE_BLOCK_KIND = 'code'/)
  assert.match(codec, /text: block\.text/)
  assert.match(codec, /language: block\.language/)
  const highlighterImport = /^\s*import .*from ['"][^'"]*(?:prism|monaco|codemirror|shiki|highlight)[^'"]*['"]/im
  assert.doesNotMatch(codec, highlighterImport)
  assert.doesNotMatch(codeBlocks, highlighterImport)
})

test('attachments remain outside the code block cut', () => {
  const registry = readFileSync('src/features/editor/editorSurfaceRegistry.ts', 'utf8')
  assert.match(registry, /richBlocks: true/)
  assert.match(registry, /attachments: false/)
  assert.doesNotMatch(codeBlocks, /FileReader|Blob|URL\.createObjectURL|input[^>]+type=["']file["']/)
})
