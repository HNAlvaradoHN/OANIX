from pathlib import Path
import re


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:140]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def replace_regex_once(path: str, pattern: str, repl: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    updated, count = re.subn(pattern, repl, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'Expected one regex match in {path}, got {count}: {pattern[:120]!r}')
    p.write_text(updated, encoding='utf-8')

# -----------------------------------------------------------------------------
# Image layout: mobile maximum margin + resize from either axis while preserving ratio.
# -----------------------------------------------------------------------------
layout = Path('src/features/images/imageLayout.ts')
layout.write_text('''export const MOBILE_IMAGE_BREAKPOINT = 760

const DESKTOP_MIN_IMAGE_WIDTH_PERCENT = 35
const DESKTOP_MIN_IMAGE_WIDTH_PIXELS = 220
const MOBILE_MIN_IMAGE_WIDTH_PERCENT = 22
const MOBILE_MIN_IMAGE_WIDTH_PIXELS = 88
const DESKTOP_MAX_IMAGE_WIDTH_PERCENT = 100
const MOBILE_MAX_IMAGE_WIDTH_PERCENT = 96
const DESKTOP_DEFAULT_IMAGE_WIDTH_PERCENT = 100
const MOBILE_DEFAULT_IMAGE_WIDTH_PERCENT = 88

export function isMobileImageViewport(viewportWidth: number): boolean {
  return Number.isFinite(viewportWidth) && viewportWidth <= MOBILE_IMAGE_BREAKPOINT
}

export function defaultImageWidthPercent(mobile: boolean): number {
  return mobile ? MOBILE_DEFAULT_IMAGE_WIDTH_PERCENT : DESKTOP_DEFAULT_IMAGE_WIDTH_PERCENT
}

export function clampImageWidthPercent(
  editorWidth: number,
  widthPercent: number,
  mobile: boolean,
): number {
  const minimumPercent = mobile
    ? MOBILE_MIN_IMAGE_WIDTH_PERCENT
    : DESKTOP_MIN_IMAGE_WIDTH_PERCENT
  const minimumPixels = mobile
    ? MOBILE_MIN_IMAGE_WIDTH_PIXELS
    : DESKTOP_MIN_IMAGE_WIDTH_PIXELS
  const maximum = mobile
    ? MOBILE_MAX_IMAGE_WIDTH_PERCENT
    : DESKTOP_MAX_IMAGE_WIDTH_PERCENT

  const pixelMinimum = editorWidth > 0 ? (minimumPixels / editorWidth) * 100 : maximum
  const minimum = Math.min(maximum, Math.max(minimumPercent, Math.ceil(pixelMinimum)))

  return Math.min(maximum, Math.max(minimum, Math.round(widthPercent)))
}

interface ResizeImageWidthInput {
  editorWidth: number
  startWidthPercent: number
  previewWidth: number
  previewHeight: number
  deltaX: number
  deltaY: number
  direction: string
  mobile: boolean
}

export function resizeImageWidthPercent({
  editorWidth,
  startWidthPercent,
  previewWidth,
  previewHeight,
  deltaX,
  deltaY,
  direction,
  mobile,
}: ResizeImageWidthInput): number {
  const horizontalMultiplier = direction.includes('w') ? -1 : 1
  const verticalMultiplier = direction.includes('n') ? -1 : 1
  const horizontalDelta = deltaX * horizontalMultiplier
  const aspectWidthPerHeight = previewWidth > 0 && previewHeight > 0
    ? previewWidth / previewHeight
    : 1
  const verticalDelta = deltaY * verticalMultiplier * aspectWidthPerHeight
  const deltaPixels = Math.abs(verticalDelta) > Math.abs(horizontalDelta)
    ? verticalDelta
    : horizontalDelta
  const deltaPercent = editorWidth > 0 ? (deltaPixels / editorWidth) * 100 : 0

  return clampImageWidthPercent(
    editorWidth,
    startWidthPercent + deltaPercent,
    mobile,
  )
}
''', encoding='utf-8')

# -----------------------------------------------------------------------------
# Image editor: corner resize reacts to X/Y, preserving natural image ratio.
# -----------------------------------------------------------------------------
replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    "import { clampImageWidthPercent, defaultImageWidthPercent, isMobileImageViewport } from './imageLayout'",
    "import { clampImageWidthPercent, defaultImageWidthPercent, isMobileImageViewport, resizeImageWidthPercent } from './imageLayout'",
)
replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    '''interface ResizeState {\n  pointerId: number\n  blockId: string\n  figure: HTMLElement\n  startX: number\n  startWidthPercent: number\n  editorWidth: number\n  direction: string\n}\n''',
    '''interface ResizeState {\n  pointerId: number\n  blockId: string\n  figure: HTMLElement\n  startX: number\n  startY: number\n  startWidthPercent: number\n  editorWidth: number\n  previewWidth: number\n  previewHeight: number\n  direction: string\n}\n''',
)
replace_regex_once(
    'src/features/images/ImageNoteEditor.tsx',
    r'''      resizeState = \{\n        pointerId: event\.pointerId,\n        blockId,\n        figure,\n        startX: event\.clientX,\n        startWidthPercent: imageWidthPercent\(block\),\n        editorWidth: editor\.getBoundingClientRect\(\)\.width,\n        direction: handle\.dataset\.imageResize \?\? 'se',\n      \}\n''',
    '''      const previewRect = figure\n        .querySelector<HTMLElement>('[data-image-preview="true"]')\n        ?.getBoundingClientRect()\n\n      resizeState = {\n        pointerId: event.pointerId,\n        blockId,\n        figure,\n        startX: event.clientX,\n        startY: event.clientY,\n        startWidthPercent: imageWidthPercent(block),\n        editorWidth: editor.getBoundingClientRect().width,\n        previewWidth: previewRect?.width ?? figure.getBoundingClientRect().width,\n        previewHeight: previewRect?.height ?? figure.getBoundingClientRect().height,\n        direction: handle.dataset.imageResize ?? 'se',\n      }\n''',
)
replace_regex_once(
    'src/features/images/ImageNoteEditor.tsx',
    r'''    function handlePointerMove\(event: PointerEvent\) \{\n      if \(!resizeState \|\| resizeState\.pointerId !== event\.pointerId\) return\n\n      const directionMultiplier = resizeState\.direction\.includes\('w'\) \? -1 : 1\n      const deltaPixels = \(event\.clientX - resizeState\.startX\) \* directionMultiplier\n      const deltaPercent = resizeState\.editorWidth > 0\n        \? \(deltaPixels / resizeState\.editorWidth\) \* 100\n        : 0\n      const nextWidth = clampImageWidth\(\n        resizeState\.editorWidth,\n        resizeState\.startWidthPercent \+ deltaPercent,\n      \)\n''',
    '''    function handlePointerMove(event: PointerEvent) {\n      if (!resizeState || resizeState.pointerId !== event.pointerId) return\n\n      const nextWidth = resizeImageWidthPercent({\n        editorWidth: resizeState.editorWidth,\n        startWidthPercent: resizeState.startWidthPercent,\n        previewWidth: resizeState.previewWidth,\n        previewHeight: resizeState.previewHeight,\n        deltaX: event.clientX - resizeState.startX,\n        deltaY: event.clientY - resizeState.startY,\n        direction: resizeState.direction,\n        mobile: usesMobileImageLayout(),\n      })\n''',
)

# -----------------------------------------------------------------------------
# Code editor: add full-screen editor and resilient decoration.
# -----------------------------------------------------------------------------
code_path = 'src/features/editor/CodeBlockEditor.tsx'
replace_regex_once(
    code_path,
    r'''function decorateCodeBlocks\(root: HTMLElement\): void \{.*?\n\}\n\nfunction createDeleteDialog\(''',
    '''function decorateCodeBlocks(root: HTMLElement): void {\n  root.querySelectorAll<HTMLElement>('.editor-code-block__toolbar').forEach((toolbar) => {\n    const copyButton = toolbar.querySelector('[data-code-copy="true"]')\n\n    if (!toolbar.querySelector('[data-code-convert="true"]')) {\n      const convert = document.createElement('button')\n      convert.type = 'button'\n      convert.className = 'editor-code-block__convert'\n      convert.dataset.codeConvert = 'true'\n      convert.textContent = 'Convertir a texto'\n      convert.title = 'Quitar el formato de código y conservar todo el contenido'\n      convert.setAttribute('aria-label', 'Convertir bloque de código a texto conservando el contenido')\n\n      const remove = document.createElement('button')\n      remove.type = 'button'\n      remove.className = 'editor-code-block__delete'\n      remove.dataset.codeDelete = 'true'\n      remove.textContent = 'Eliminar bloque'\n      remove.title = 'Eliminar el bloque y todo su contenido'\n      remove.setAttribute('aria-label', 'Eliminar bloque de código y su contenido')\n\n      toolbar.insertBefore(convert, copyButton)\n      toolbar.insertBefore(remove, copyButton)\n    }\n\n    if (!toolbar.querySelector('[data-code-expand="true"]')) {\n      const expand = document.createElement('button')\n      expand.type = 'button'\n      expand.className = 'editor-code-block__expand'\n      expand.dataset.codeExpand = 'true'\n      expand.textContent = 'Ver completo'\n      expand.title = 'Ver y editar código en pantalla completa'\n      expand.setAttribute('aria-label', 'Ver código completo y editarlo en pantalla completa')\n      toolbar.insertBefore(expand, copyButton)\n    }\n  })\n}\n\ninterface CodeFullscreenDialog {\n  element: HTMLElement\n  close: () => void\n}\n\nfunction createCodeFullscreenDialog(\n  root: HTMLElement,\n  block: HTMLElement,\n  onClose: () => void,\n): CodeFullscreenDialog | null {\n  const editor = root.querySelector<HTMLElement>('.editor-surface')\n  const sourceContent = block.querySelector<HTMLElement>('[data-code-content="true"]')\n  const sourceLanguage = block.querySelector<HTMLSelectElement>('[data-code-language="true"]')\n  if (!editor || !sourceContent || !sourceLanguage) return null\n\n  const backdrop = document.createElement('div')\n  backdrop.className = 'code-fullscreen-dialog'\n  backdrop.setAttribute('role', 'presentation')\n\n  const panel = document.createElement('div')\n  panel.className = 'code-fullscreen-dialog__panel'\n  panel.setAttribute('role', 'dialog')\n  panel.setAttribute('aria-modal', 'true')\n  panel.setAttribute('aria-label', 'Editor de código completo')\n\n  const header = document.createElement('div')\n  header.className = 'code-fullscreen-dialog__header'\n\n  const title = document.createElement('strong')\n  title.textContent = 'Código completo'\n\n  const done = document.createElement('button')\n  done.type = 'button'\n  done.className = 'code-fullscreen-dialog__done'\n  done.textContent = 'Listo'\n  done.setAttribute('aria-label', 'Guardar cambios del código y cerrar')\n\n  header.append(title, done)\n\n  const language = sourceLanguage.cloneNode(true) as HTMLSelectElement\n  language.className = 'code-fullscreen-dialog__language'\n  language.removeAttribute('data-code-language')\n  language.value = sourceLanguage.value\n  language.setAttribute('aria-label', 'Lenguaje del código completo')\n\n  const textarea = document.createElement('textarea')\n  textarea.className = 'code-fullscreen-dialog__editor'\n  textarea.value = codeText(block)\n  textarea.spellcheck = false\n  textarea.autocapitalize = 'off'\n  textarea.autocomplete = 'off'\n  textarea.setAttribute('aria-label', 'Contenido completo del bloque de código')\n  textarea.setAttribute('wrap', 'soft')\n\n  const hint = document.createElement('p')\n  hint.className = 'code-fullscreen-dialog__hint'\n  hint.textContent = 'Las líneas largas se ajustan solo en pantalla; OANIX no agrega saltos al código.'\n\n  panel.append(header, language, textarea, hint)\n  backdrop.append(panel)\n\n  const previousBodyOverflow = document.body.style.overflow\n  document.body.style.overflow = 'hidden'\n  document.body.append(backdrop)\n  textarea.focus()\n  textarea.setSelectionRange(textarea.value.length, textarea.value.length)\n\n  let closed = false\n  function close() {\n    if (closed) return\n    closed = true\n\n    if (block.isConnected && root.contains(block)) {\n      sourceContent.textContent = textarea.value\n      sourceLanguage.value = language.value\n      block.dataset.language = language.value\n      Array.from(sourceLanguage.options).forEach((option) => {\n        option.toggleAttribute('selected', option.value === language.value)\n      })\n\n      sourceContent.focus()\n      placeCaretAtEnd(sourceContent)\n      sourceContent.dispatchEvent(new Event('input', { bubbles: true }))\n    }\n\n    document.body.style.overflow = previousBodyOverflow\n    backdrop.remove()\n    onClose()\n  }\n\n  done.addEventListener('click', close)\n  textarea.addEventListener('keydown', (event) => {\n    if (event.key !== 'Tab') return\n    event.preventDefault()\n    const start = textarea.selectionStart\n    const end = textarea.selectionEnd\n    textarea.setRangeText('\\t', start, end, 'end')\n  })\n\n  return { element: backdrop, close }\n}\n\nfunction createDeleteDialog(''',
)

# Add fullscreen state and click handling.
replace_once(
    code_path,
    '''    let activeDialog: HTMLElement | null = null\n\n    decorateCodeBlocks(root)\n''',
    '''    let activeDialog: HTMLElement | null = null\n    let activeFullscreenDialog: CodeFullscreenDialog | null = null\n\n    decorateCodeBlocks(root)\n''',
)
replace_once(
    code_path,
    '''    function closeActiveDialog() {\n      activeDialog?.remove()\n      activeDialog = null\n    }\n''',
    '''    function closeActiveDialog() {\n      activeDialog?.remove()\n      activeDialog = null\n    }\n\n    function closeFullscreenDialog() {\n      const dialog = activeFullscreenDialog\n      activeFullscreenDialog = null\n      dialog?.close()\n    }\n''',
)
replace_once(
    code_path,
    '''      const deleteButton = target.closest<HTMLElement>('[data-code-delete="true"]')\n''',
    '''      const expandButton = target.closest<HTMLElement>('[data-code-expand="true"]')\n      if (expandButton && root.contains(expandButton)) {\n        const block = expandButton.closest<HTMLElement>('[data-code-block="true"]')\n        if (!block) return\n\n        event.preventDefault()\n        event.stopPropagation()\n        closeActiveDialog()\n        closeFullscreenDialog()\n        activeFullscreenDialog = createCodeFullscreenDialog(root, block, () => {\n          activeFullscreenDialog = null\n        })\n        return\n      }\n\n      const deleteButton = target.closest<HTMLElement>('[data-code-delete="true"]')\n''',
)
replace_once(
    code_path,
    '''    function handleKeyDown(event: KeyboardEvent) {\n      if (event.key === 'Escape' && activeDialog) {\n        event.preventDefault()\n        closeActiveDialog()\n      }\n    }\n''',
    '''    function handleKeyDown(event: KeyboardEvent) {\n      if (event.key !== 'Escape') return\n\n      if (activeFullscreenDialog) {\n        event.preventDefault()\n        closeFullscreenDialog()\n        return\n      }\n\n      if (activeDialog) {\n        event.preventDefault()\n        closeActiveDialog()\n      }\n    }\n''',
)
replace_once(
    code_path,
    '''      document.removeEventListener('selectionchange', syncCodeSelectionMode)\n      closeActiveDialog()\n    }\n''',
    '''      document.removeEventListener('selectionchange', syncCodeSelectionMode)\n      closeActiveDialog()\n      closeFullscreenDialog()\n    }\n''',
)

# -----------------------------------------------------------------------------
# Mobile image CSS: no side flow, safe max width, larger touch handles, clean panel.
# -----------------------------------------------------------------------------
images_css = Path('src/features/images/images.css')
with images_css.open('a', encoding='utf-8') as f:
    f.write('''\n\n/* OANIX mobile block-only image layout and readable image actions */\n@media (max-width: 760px) {\n  .image-note-editor-root .editor-surface > .editor-image-block {\n    float: none !important;\n    clear: both;\n    display: block;\n    max-width: calc(100% - 0.45rem);\n    box-sizing: border-box;\n    margin-top: 0.85rem;\n    margin-bottom: 0.85rem;\n  }\n\n  .image-note-editor-root .editor-image-block__resize {\n    width: 1.35rem;\n    height: 1.35rem;\n    border-radius: 6px;\n  }\n\n  .image-note-editor-root .editor-image-block__resize--nw { top: -0.65rem; left: -0.4rem; }\n  .image-note-editor-root .editor-image-block__resize--ne { top: -0.65rem; right: -0.4rem; }\n  .image-note-editor-root .editor-image-block__resize--sw { bottom: -0.65rem; left: -0.4rem; }\n  .image-note-editor-root .editor-image-block__resize--se { right: -0.4rem; bottom: -0.65rem; }\n\n  .image-note-editor-root .editor-image-block[data-image-compact='true'][data-image-info-open='true'] .editor-image-block__footer {\n    width: min(21rem, calc(100vw - 2rem));\n    max-width: calc(100vw - 2rem);\n    box-sizing: border-box;\n    padding: 0.7rem;\n  }\n\n  .image-note-editor-root .editor-image-block[data-image-compact='true'][data-image-info-open='true'] .editor-image-block__actions {\n    display: grid;\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n    align-items: stretch;\n    gap: 0.45rem;\n  }\n\n  .image-note-editor-root .editor-image-block[data-image-compact='true'][data-image-info-open='true'] .editor-image-block__actions button {\n    width: 100%;\n    min-width: 0;\n    min-height: 2.4rem;\n    padding: 0.45rem 0.55rem;\n    line-height: 1.15;\n    overflow-wrap: normal;\n    word-break: normal;\n    white-space: nowrap;\n  }\n\n  .image-note-editor-root .editor-image-block[data-image-compact='true'][data-image-info-open='true'] .editor-image-block__lock,\n  .image-note-editor-root .editor-image-block[data-image-compact='true'][data-image-info-open='true'] .editor-image-block__info {\n    width: 100%;\n    min-width: 0;\n  }\n\n  .image-note-editor-root .editor-image-block[data-image-compact='true'][data-image-info-open='true'] .editor-image-block__alignment {\n    grid-column: 1 / -1;\n    order: initial;\n    width: 100%;\n    display: grid;\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n  }\n\n  .image-note-editor-root .editor-image-block[data-image-compact='true'][data-image-info-open='true'] .editor-image-block__alignment button {\n    padding-inline: 0.3rem;\n  }\n\n  .image-note-editor-root .editor-image-block[data-image-compact='true'][data-image-info-open='true'] .editor-image-block__details {\n    gap: 0.5rem;\n  }\n}\n''')

# -----------------------------------------------------------------------------
# Code CSS: contained compact card + fullscreen editor.
# -----------------------------------------------------------------------------
code_css = Path('src/features/editor/codeBlockEditor.css')
with code_css.open('a', encoding='utf-8') as f:
    f.write('''\n\n/* OANIX contained code card and full-screen code editor */\n.code-block-editor-root .editor-code-block,\n.code-block-editor-root .editor-code-block__toolbar,\n.code-block-editor-root .editor-code-block__content {\n  min-width: 0;\n  max-width: 100%;\n  box-sizing: border-box;\n}\n\n.code-block-editor-root .editor-code-block__expand {\n  padding: 0.42rem 0.7rem;\n  border: 0;\n  border-radius: 8px;\n  background: transparent;\n  color: #cbd5e1;\n  -webkit-text-fill-color: currentColor;\n  font: inherit;\n  font-size: 0.76rem;\n  font-weight: 700;\n  cursor: pointer;\n}\n\n.code-block-editor-root .editor-code-block__expand:hover,\n.code-block-editor-root .editor-code-block__expand:focus-visible {\n  outline: none;\n  background: rgba(59, 130, 246, 0.16);\n  color: #dbeafe;\n}\n\n.code-fullscreen-dialog {\n  position: fixed;\n  z-index: 1700;\n  inset: 0;\n  background: #0b1220;\n}\n\n.code-fullscreen-dialog__panel {\n  width: 100vw;\n  height: 100dvh;\n  display: grid;\n  grid-template-rows: auto auto minmax(0, 1fr) auto;\n  gap: 0.7rem;\n  box-sizing: border-box;\n  padding:\n    max(0.75rem, env(safe-area-inset-top))\n    max(0.75rem, env(safe-area-inset-right))\n    max(0.75rem, env(safe-area-inset-bottom))\n    max(0.75rem, env(safe-area-inset-left));\n  background: #0f172a;\n  color: #e5edf8;\n}\n\n.code-fullscreen-dialog__header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 1rem;\n  min-width: 0;\n}\n\n.code-fullscreen-dialog__header strong {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 1rem;\n}\n\n.code-fullscreen-dialog__done,\n.code-fullscreen-dialog__language {\n  min-height: 2.7rem;\n  border: 1px solid #334155;\n  border-radius: 10px;\n  background: #1e293b;\n  color: #e5edf8;\n  font: inherit;\n  font-weight: 750;\n}\n\n.code-fullscreen-dialog__done {\n  flex: 0 0 auto;\n  padding: 0 1rem;\n  background: #2563eb;\n  border-color: #2563eb;\n  color: #fff;\n}\n\n.code-fullscreen-dialog__language {\n  width: 100%;\n  min-width: 0;\n  padding: 0 0.75rem;\n}\n\n.code-fullscreen-dialog__editor {\n  width: 100%;\n  min-width: 0;\n  min-height: 0;\n  height: 100%;\n  box-sizing: border-box;\n  resize: none;\n  padding: 1rem;\n  border: 1px solid #334155;\n  border-radius: 12px;\n  outline: none;\n  background: #0b1220;\n  color: #e5edf8;\n  caret-color: #fff;\n  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;\n  font-size: 0.95rem;\n  line-height: 1.55;\n  tab-size: 2;\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n  word-break: break-word;\n  overflow: auto;\n}\n\n.code-fullscreen-dialog__editor:focus {\n  border-color: #3b82f6;\n  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);\n}\n\n.code-fullscreen-dialog__hint {\n  margin: 0;\n  color: #94a3b8;\n  font-size: 0.73rem;\n  line-height: 1.35;\n}\n\n@media (max-width: 640px) {\n  .code-block-editor-root .editor-code-block {\n    width: calc(100% - 0.45rem);\n    max-width: calc(100% - 0.45rem);\n    margin-right: auto;\n    margin-left: auto;\n    overflow: hidden;\n  }\n\n  .code-block-editor-root .editor-code-block__content {\n    max-height: 18rem;\n    overflow-x: hidden;\n    overflow-y: auto;\n    white-space: pre-wrap;\n    overflow-wrap: anywhere;\n    word-break: break-word;\n  }\n\n  .code-block-editor-root .editor-code-block__convert,\n  .code-block-editor-root .editor-code-block__delete,\n  .code-block-editor-root .editor-code-block__expand,\n  .code-block-editor-root .editor-code-block__copy {\n    width: 100%;\n    min-width: 0;\n    min-height: 2.5rem;\n    margin: 0;\n    padding: 0.5rem 0.4rem;\n    line-height: 1.15;\n    text-align: center;\n    white-space: normal;\n    overflow-wrap: anywhere;\n  }\n\n  .code-block-editor-root .editor-code-block__copy {\n    grid-column: auto;\n  }\n}\n''')

# -----------------------------------------------------------------------------
# Responsive image tests.
# -----------------------------------------------------------------------------
tests = Path('tests/imageLayout.test.ts')
tests.write_text('''import assert from 'node:assert/strict'\nimport test from 'node:test'\n\nimport {\n  clampImageWidthPercent,\n  defaultImageWidthPercent,\n  isMobileImageViewport,\n  resizeImageWidthPercent,\n} from '../src/features/images/imageLayout.ts'\n\ntest('detects mobile image viewport at the editor breakpoint', () => {\n  assert.equal(isMobileImageViewport(760), true)\n  assert.equal(isMobileImageViewport(761), false)\n})\n\ntest('uses a smaller default image width on mobile', () => {\n  assert.equal(defaultImageWidthPercent(true), 88)\n  assert.equal(defaultImageWidthPercent(false), 100)\n})\n\ntest('allows substantially smaller images on a typical mobile editor', () => {\n  assert.equal(clampImageWidthPercent(340, 5, true), 26)\n  assert.equal(clampImageWidthPercent(340, 50, true), 50)\n})\n\ntest('keeps a small horizontal safety margin at maximum mobile size', () => {\n  assert.equal(clampImageWidthPercent(340, 140, true), 96)\n  assert.equal(clampImageWidthPercent(800, 140, false), 100)\n})\n\ntest('keeps the wider desktop safety minimum', () => {\n  assert.equal(clampImageWidthPercent(800, 5, false), 35)\n  assert.equal(clampImageWidthPercent(500, 5, false), 44)\n})\n\ntest('resizes proportionally from horizontal corner movement', () => {\n  assert.equal(resizeImageWidthPercent({\n    editorWidth: 340,\n    startWidthPercent: 50,\n    previewWidth: 170,\n    previewHeight: 100,\n    deltaX: 34,\n    deltaY: 0,\n    direction: 'se',\n    mobile: true,\n  }), 60)\n})\n\ntest('resizes proportionally from vertical corner movement', () => {\n  assert.equal(resizeImageWidthPercent({\n    editorWidth: 340,\n    startWidthPercent: 50,\n    previewWidth: 170,\n    previewHeight: 340,\n    deltaX: 0,\n    deltaY: 68,\n    direction: 'se',\n    mobile: true,\n  }), 60)\n})\n''', encoding='utf-8')

# -----------------------------------------------------------------------------
# Documentation: record this refinement as part of the pending mobile pass.
# -----------------------------------------------------------------------------
roadmap = Path('docs/ROADMAP.md')
text = roadmap.read_text(encoding='utf-8')
needle = '- [ ] Revisar el comportamiento con teclado virtual, scroll, selección de texto, imágenes y bloques especiales.\n'
addition = needle + '- [ ] En móvil, tratar imágenes como bloques completos sin texto lateral y permitir escalarlas desde cualquier esquina sin salir del margen útil.\n- [ ] Mantener los bloques de código contenidos dentro de la nota y ofrecer una vista/editor de código a pantalla completa para líneas largas.\n'
if needle not in text:
    raise SystemExit('Roadmap marker not found')
roadmap.write_text(text.replace(needle, addition, 1), encoding='utf-8')

changelog = Path('docs/CHANGELOG.md')
text = changelog.read_text(encoding='utf-8')
marker = '## Unreleased\n'
entry = marker + '- Refinamiento móvil de imágenes y código: imágenes sin flujo lateral, escalado proporcional por ambos ejes, panel de acciones legible, código contenido y editor de código a pantalla completa.\n'
if marker not in text:
    raise SystemExit('Changelog Unreleased marker not found')
changelog.write_text(text.replace(marker, entry, 1), encoding='utf-8')
''