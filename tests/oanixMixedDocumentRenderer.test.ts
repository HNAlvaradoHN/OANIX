import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sourcePath = new URL('../src/features/editor/implementations/OanixMixedDocumentBody.tsx', import.meta.url)

async function readSource(): Promise<string> {
  return readFile(sourcePath, 'utf8')
}

test('mixed renderer keeps text segments uncontrolled and avoids per-key React state', async () => {
  const source = await readSource()
  assert.match(source, /defaultValue=\{block\.text\}/)
  assert.match(source, /onInput=/)
  assert.doesNotMatch(source, /value=\{block\.text\}/)
  assert.doesNotMatch(source, /setText\(/)
})

test('mixed renderer loads image bytes lazily and revokes temporary object URLs', async () => {
  const source = await readSource()
  assert.match(source, /IntersectionObserver/)
  assert.match(source, /URL\.createObjectURL\(file\)/)
  assert.match(source, /URL\.revokeObjectURL\(url\)/)
  assert.doesNotMatch(source, /data:image\//)
  assert.doesNotMatch(source, /base64/)
})

test('mixed renderer keeps images in normal document flow instead of overlays', async () => {
  const source = await readSource()
  assert.match(source, /OanixInsertableElementFrame/)
  assert.doesNotMatch(source, /position:\s*['"]absolute['"]/)
  assert.doesNotMatch(source, /translateY\(/)
  assert.doesNotMatch(source, /selectionStart.*style/)
})
