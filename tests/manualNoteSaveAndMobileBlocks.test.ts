import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const notesWorkspacePath = new URL('../src/features/notes/NotesWorkspace.tsx', import.meta.url)
const previewRuntimePath = new URL('../src/features/images/PwaImagePreviewRuntime.tsx', import.meta.url)
const previewCssPath = new URL('../src/features/images/pwa-image-preview.css', import.meta.url)

test('note content remains local while typing and persists explicitly or before leaving', async () => {
  const source = await readFile(notesWorkspacePath, 'utf8')
  const changeHandler = source.match(/function handleContentChange\(blocks: StoredNoteBlock\[\]\) \{([\s\S]*?)\n  \}/)?.[1] ?? ''
  const handleBackStart = source.indexOf('async function handleBack()')
  const handleLockStart = source.indexOf('async function handleLockWorkspace()', handleBackStart)
  const handleBack = handleBackStart >= 0 && handleLockStart > handleBackStart
    ? source.slice(handleBackStart, handleLockStart)
    : ''

  assert.match(changeHandler, /pendingContentRef\.current = \{ noteId: selectedNote\.id, blocks \}/)
  assert.doesNotMatch(changeHandler, /setTimeout/)
  assert.doesNotMatch(changeHandler, /flushPendingContent\(\)/)
  assert.match(source, /className=\{`note-manual-sync/)
  assert.match(source, /onClick=\{\(\) => void flushPendingContent\(\)\}/)
  assert.match(handleBack, /if \(!\(await flushPendingContent\(\)\)\) return/)
  assert.match(handleBack, /window\.history\.back\(\)/)
  assert.ok(handleBack.indexOf('flushPendingContent()') < handleBack.indexOf('window.history.back()'))
  assert.match(source, /if \(saveState === 'saving'\) return 'Guardando nota…'/)
  assert.match(source, /onBlur=\{\(\) => undefined\}/)
})

test('mobile contact notes stay compact but expose the complete text', async () => {
  const source = await readFile(previewRuntimePath, 'utf8')
  const css = await readFile(previewCssPath, 'utf8')

  assert.match(source, /CONTACT_CARD_SELECTOR/)
  assert.match(source, /notes\.rows = 2/)
  assert.match(source, /data-pwa-contact-notes-more/)
  assert.match(source, /openTextBubble\(notes\.value\.trim\(\), 'Notas del contacto'/)
  assert.match(css, /textarea\[data-pwa-contact-notes='true'\][\s\S]*height: 3\.45rem/)
  assert.match(css, /\.pwa-contact-notes-more/)
})

test('PWA image zoom uses layout sizing instead of a giant transformed GPU layer', async () => {
  const source = await readFile(previewRuntimePath, 'utf8')
  const css = await readFile(previewCssPath, 'utf8')
  const scaleFunction = source.match(/function setLightboxScale\(lightbox: HTMLElement, scale: number\) \{([\s\S]*?)\n    \}/)?.[1] ?? ''

  assert.match(scaleFunction, /image\.style\.width =/)
  assert.match(scaleFunction, /image\.style\.transform = 'none'/)
  assert.doesNotMatch(scaleFunction, /scale\(/)
  assert.match(source, /document\.addEventListener\('dblclick', handleDoubleClick, true\)/)
  assert.match(css, /img\[data-pwa-zoom\][\s\S]*transform: none !important/)
})

test('image actions require an explicit compact menu toggle', async () => {
  const source = await readFile(previewRuntimePath, 'utf8')
  const css = await readFile(previewCssPath, 'utf8')

  assert.match(source, /dataset\.pwaActionsOpen \?\?= 'false'/)
  assert.match(source, /data-pwa-image-menu-toggle/)
  assert.match(source, /figure\.dataset\.pwaActionsOpen = String\(opening\)/)
  assert.match(css, /data-pwa-actions-open='false'[\s\S]*editor-image-block__actions[\s\S]*display: none !important/)
  assert.match(css, /\.pwa-image-card__menu-toggle/)
})
