import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sourcePath = new URL('../src/features/editor/implementations/OanixMixedDocumentBody.tsx', import.meta.url)
const mobileGuardPath = new URL('../src/features/editor/implementations/OanixNotesSheetMobileGuard.tsx', import.meta.url)
const mixedCssPath = new URL('../src/features/editor/implementations/oanixMixedDocumentBody.css', import.meta.url)

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

test('image controls stay usable after resize and distinguish tap from scroll', async () => {
  const css = await readFile(mixedCssPath, 'utf8')
  assert.match(css, /\.oanix-mixed-image__menu-button\{[^}]*inset:0/)
  assert.match(css, /touch-action:pan-y pinch-zoom/)
  assert.match(css, /\.oanix-mixed-image__menu\{[^}]*grid-auto-flow:column/)
  assert.match(css, /\.oanix-mixed-image__menu\[data-direction="down"\]\{top:calc\(100% \+ 10px\)\}/)
  assert.match(css, /\.oanix-mixed-image__menu\[data-direction="up"\]\{bottom:calc\(100% \+ 10px\)\}/)
  assert.match(css, /width:min\(320px,calc\(100vw - 40px\)\)/)
  assert.match(css, /background:rgba\(20,22,28,\.94\)/)
  assert.match(css, /:has\(\.oanix-mixed-image__menu\[data-direction="up"\]\) \.oanix-mixed-image__resize-control\{top:10px;bottom:auto\}/)
  assert.match(css, /:has\(\.oanix-mixed-image__menu\[data-direction="down"\]\) \.oanix-mixed-image__resize-control\{top:auto;bottom:10px\}/)
})

test('image lock is the only resize toggle and outside interaction relocks the current size', async () => {
  const source = await readSource()
  const imageStart = source.indexOf('function OanixMixedImage')
  const longTextStart = source.indexOf('function OanixLongTextExpanded')
  assert.ok(imageStart >= 0)
  assert.ok(longTextStart > imageStart)
  const imageSource = source.slice(imageStart, longTextStart)

  assert.doesNotMatch(imageSource, /<span>Redimensionar<\/span>/)
  assert.match(imageSource, /function lockResizeAndClose\(\)/)
  assert.match(imageSource, /persistPresentation\(widthPercent, true\)/)
  assert.match(imageSource, /const showResize = !sizeLocked && Boolean\(url\)/)
  assert.doesNotMatch(imageSource, /resizeActive|setResizeActive/)
  assert.match(imageSource, /if \(sizeLocked\) \{[\s\S]*persistPresentation\(widthPercent, false\)/)
  assert.match(imageSource, /window\.addEventListener\('pointerdown', close\)/)
  assert.match(imageSource, /if \(event\.key === 'Escape'\) lockResizeAndClose\(\)/)
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
  assert.match(guard, /const active = document\.activeElement[\s\S]*return isGuardedTextarea\(active\) && editor\.contains\(active\) \? active : null/)
})
