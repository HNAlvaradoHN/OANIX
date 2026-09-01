import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const home = readFileSync('src/features/rebuild/RebuildApp.tsx', 'utf8')
const host = readFileSync('src/features/editor/EditorSurface.tsx', 'utf8')
const registry = readFileSync('src/features/editor/editorSurfaceRegistry.ts', 'utf8')
const plainTextAdapter = readFileSync(
  'src/features/editor/implementations/PlainTextEditorSurface.tsx',
  'utf8',
)

test('Home depends on the replaceable editor host instead of a concrete sheet implementation', () => {
  assert.match(home, /import \{ EditorSurface \} from '\.\.\/editor\/EditorSurface'/)
  assert.match(home, /import type \{ EditorSurfaceSnapshot \} from '\.\.\/editor\/editorSurfaceContract'/)
  assert.match(home, /<EditorSurface[\s\S]*onRequestSave=\{saveEditorSnapshot\}[\s\S]*onRequestClose=\{closeEditor\}/)
  assert.doesNotMatch(home, /from '\.\.\/editor\/NoteEditor'/)
  assert.doesNotMatch(
    home,
    /^\s*import .*from ['"][^'"]*(?:ruledSheet|Aurora|qwen)[^'"]*['"]/im,
  )
})

test('the host delegates concrete selection to the editor surface registry and mounts it lazily', () => {
  assert.match(host, /import \{ lazy, Suspense \} from 'react'/)
  assert.match(host, /from '\.\/editorSurfaceRegistry'/)
  assert.match(host, /const ActiveSurface = lazy\(activeEditorSurface\.load\)/)
  assert.match(host, /<Suspense fallback=\{null\}>/)
  assert.match(host, /<ActiveSurface \{\.\.\.props\} \/>/)
  assert.match(host, /activeEditorSurface\.capabilities/)
  assert.doesNotMatch(host, /from '\.\/NoteEditor'/)
  assert.doesNotMatch(host, /from '\.\/implementations\//)
  assert.doesNotMatch(
    host,
    /^\s*import .*from ['"][^'"]*(?:ruledSheet|Aurora|qwen)[^'"]*['"]/im,
  )
})

test('the registry is the only composition point and does not eagerly import the current implementation', () => {
  assert.match(registry, /export const activeEditorSurface: EditorSurfaceDefinition/)
  assert.match(registry, /load: async \(\) => \{/)
  assert.match(registry, /await import\([\s\S]*\.\/implementations\/PlainTextEditorSurface/)
  assert.match(registry, /return \{ default: PlainTextEditorSurface \}/)
  assert.match(registry, /plainText: true/)
  assert.match(registry, /richBlocks: false/)
  assert.match(registry, /attachments: false/)
  assert.doesNotMatch(registry, /^\s*import .*PlainTextEditorSurface/m)
  assert.doesNotMatch(registry, /from '\.\/NoteEditor'/)
  assert.doesNotMatch(
    registry,
    /^\s*import .*from ['"][^'"]*(?:ruledSheet|Aurora|qwen)[^'"]*['"]/im,
  )
})

test('the transitional adapter alone knows the current plain-text editor', () => {
  assert.match(plainTextAdapter, /import \{ NoteEditor \} from '\.\.\/NoteEditor'/)
  assert.match(plainTextAdapter, /export function PlainTextEditorSurface\(\{/)
  assert.match(plainTextAdapter, /\}: EditorSurfaceProps\)/)
  assert.match(plainTextAdapter, /<NoteEditor/)
  assert.match(plainTextAdapter, /initialTitle=\{initialTitle\}/)
  assert.match(plainTextAdapter, /initialText=\{initialText\}/)
  assert.match(plainTextAdapter, /onRequestSave=\{onRequestSave\}/)
  assert.match(plainTextAdapter, /onRequestClose=\{onRequestClose\}/)
  assert.doesNotMatch(plainTextAdapter, /<NoteEditor \{\.\.\.props\}/)
  assert.doesNotMatch(plainTextAdapter, /EditorSurfaceCapabilities|plainTextEditorSurfaceCapabilities/)
})
