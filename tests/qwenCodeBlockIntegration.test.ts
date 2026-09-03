import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const surface = readFileSync('src/features/editor/implementations/QwenSheetSurface.tsx', 'utf8')
const richBlocks = readFileSync('src/features/editor/implementations/QwenRichBlocks.tsx', 'utf8')
const codec = readFileSync('src/features/editor/codeBlockCodec.ts', 'utf8')

test('Qwen mounts one ordered rich block controller on the shared session', () => {
  assert.match(surface, /<QwenRichBlocks[\s\S]*session=\{blockSession\}/)
  assert.equal((surface.match(/createEditorBlockSession\(/g) ?? []).length, 1)
  assert.equal((richBlocks.match(/session\.load\(\)/g) ?? []).length, 1)
})

test('code block UI buffers mutations through the editor session only', () => {
  assert.match(richBlocks, /decodeCodeBlock/)
  assert.match(richBlocks, /encodeCodeBlock/)
  assert.match(richBlocks, /session\.upsert\(next\)/)
  assert.match(richBlocks, /session\.remove\(blockId\)/)
  assert.doesNotMatch(richBlocks, /indexedDB|localStorage|sessionStorage|fetch\(|XMLHttpRequest/)
  assert.doesNotMatch(richBlocks, /setTimeout|setInterval/)
})

test('code blocks remain plain persisted text without runtime highlighting dependencies', () => {
  assert.match(codec, /CODE_BLOCK_KIND = 'code'/)
  assert.match(codec, /text: block\.text/)
  assert.match(codec, /language: block\.language/)
  const highlighterImport = /^\s*import .*from ['"][^'"]*(?:prism|monaco|codemirror|shiki|highlight)[^'"]*['"]/im
  assert.doesNotMatch(codec, highlighterImport)
  assert.doesNotMatch(richBlocks, highlighterImport)
})

test('attachments and rich blocks remain disabled in the active plain-text phase', () => {
  const registry = readFileSync('src/features/editor/editorSurfaceRegistry.ts', 'utf8')
  assert.match(registry, /richBlocks: false/)
  assert.match(registry, /attachments: false/)
  assert.doesNotMatch(richBlocks, /FileReader|Blob|URL\.createObjectURL|input[^>]+type=["']file["']/)
})
