import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createEditorBlockChangeBuffer } from '../src/features/editor/editorBlockChangeBuffer.ts'
import type { EditorSurfaceBlock } from '../src/features/editor/editorSurfaceContract.ts'

const sourceUrl = new URL('../src/features/editor/implementations/QwenRichBlocks.tsx', import.meta.url)

function block(id: string): EditorSurfaceBlock {
  return { id, kind: 'text', data: { text: id } }
}

test('reordering existing blocks produces only an order checkpoint', () => {
  const buffer = createEditorBlockChangeBuffer([block('a'), block('b'), block('c')])

  assert.equal(buffer.reorder(['b', 'a', 'c']), true)
  const prepared = buffer.prepare()
  assert.ok(prepared)
  assert.deepEqual(prepared.changes, { order: ['b', 'a', 'c'] })
  assert.equal(prepared.entries.size, 0)
})

test('Qwen exposes lightweight up/down controls through the existing session', async () => {
  const source = await readFile(sourceUrl, 'utf8')

  assert.match(source, /session\.reorder\(nextOrder\)/)
  assert.match(source, /aria-label="Mover bloque arriba"/)
  assert.match(source, /aria-label="Mover bloque abajo"/)
  assert.match(source, /index === 0/)
  assert.match(source, /index === visibleBlocks\.length - 1/)
  assert.match(source, /const next = \[\.\.\.nextVisible, \.\.\.presentationBlocks\]/)

  assert.doesNotMatch(source, /dragstart|draggable|pointermove|touchmove/)
  assert.doesNotMatch(source, /setTimeout\s*\(|setInterval\s*\(/)
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/)
  assert.doesNotMatch(source, /\bfetch\s*\(/)
})
