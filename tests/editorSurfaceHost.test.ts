import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const home = readFileSync('src/features/rebuild/RebuildApp.tsx', 'utf8')
const host = readFileSync('src/features/editor/EditorSurface.tsx', 'utf8')

test('Home depends on the replaceable editor host instead of a concrete sheet implementation', () => {
  assert.match(home, /import \{ EditorSurface \} from '\.\.\/editor\/EditorSurface'/)
  assert.match(home, /import type \{ EditorSurfaceSnapshot \} from '\.\.\/editor\/editorSurfaceContract'/)
  assert.match(home, /<EditorSurface[\s\S]*onRequestSave=\{saveEditorSnapshot\}[\s\S]*onRequestClose=\{closeEditor\}/)
  assert.doesNotMatch(home, /from '\.\.\/editor\/NoteEditor'/)
  assert.doesNotMatch(home, /ruledSheet|Aurora|qwen/i)
})

test('the host is the only place that selects the current editor implementation', () => {
  assert.match(host, /import \{ NoteEditor \} from '\.\/NoteEditor'/)
  assert.match(host, /export function EditorSurface\(props: EditorSurfaceProps\)/)
  assert.match(host, /return <NoteEditor \{\.\.\.props\} \/>/)
  assert.match(host, /plainText: true/)
  assert.match(host, /richBlocks: false/)
  assert.match(host, /attachments: false/)
})
