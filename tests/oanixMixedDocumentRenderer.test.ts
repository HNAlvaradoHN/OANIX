import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sourcePath = new URL('../src/features/editor/implementations/OanixMixedDocumentBody.tsx', import.meta.url)
const mobileGuardPath = new URL('../src/features/editor/implementations/OanixNotesSheetMobileGuard.tsx', import.meta.url)

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

test('long text keeps only its bounded preview in the sheet and loads the encrypted asset inside the expanded viewer', async () => {
  const source = await readSource()
  const expandedStart = source.indexOf('function OanixLongTextExpanded')
  const cardStart = source.indexOf('function OanixMixedLongText')
  assert.ok(expandedStart >= 0)
  assert.ok(cardStart > expandedStart)

  const expandedSource = source.slice(expandedStart, cardStart)
  const cardSource = source.slice(cardStart)
  assert.match(expandedSource, /loadAttachmentFile\(attachmentId\)/)
  assert.match(expandedSource, /URL\.createObjectURL\(file\)/)
  assert.match(expandedSource, /URL\.revokeObjectURL\(objectUrl\)/)
  assert.match(expandedSource, /sandbox=""/)
  assert.match(cardSource, /block\.preview/)
  assert.doesNotMatch(cardSource, /\.text\(\)/)
})

test('mobile caret guard follows dynamically rendered mixed text without imposing the plain body minimum', async () => {
  const guard = await readFile(mobileGuardPath, 'utf8')
  assert.match(guard, /oanix-mixed-document__text/)
  assert.match(guard, /editor\.addEventListener\('focusin'/)
  assert.match(guard, /editor\.addEventListener\('beforeinput'/)
  assert.match(guard, /classList\.contains\('oanix-notes__body'\)/)
  assert.match(guard, /if \(!textarea\.classList\.contains\('oanix-notes__body'\)\) return/)
  assert.doesNotMatch(guard, /querySelector<HTMLTextAreaElement>\('\.oanix-notes__body'\)/)
})
