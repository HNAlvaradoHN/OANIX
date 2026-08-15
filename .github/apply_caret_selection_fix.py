from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


# 1) Make blank editor space create/reuse a real paragraph at the intended vertical position.
rich = 'src/features/editor/RichTextEditor.tsx'
replace_once(
    rich,
    '''function selectionIsInsideEditor(editor: HTMLElement, selection: Selection | null): selection is Selection {\n''',
    '''function placeCaretAtStart(element: HTMLElement): void {\n  const selection = window.getSelection()\n  if (!selection) return\n\n  const range = document.createRange()\n  range.selectNodeContents(element)\n  range.collapse(true)\n  selection.removeAllRanges()\n  selection.addRange(range)\n}\n\nfunction createCaretParagraph(): HTMLParagraphElement {\n  const paragraph = document.createElement('p')\n  paragraph.dataset.blockId = createBlockId()\n  paragraph.append(document.createElement('br'))\n  return paragraph\n}\n\nfunction isEmptyCaretParagraph(element: Element | null): element is HTMLParagraphElement {\n  return (\n    element instanceof HTMLParagraphElement &&\n    (element.textContent ?? '').trim() === '' &&\n    !element.querySelector('[data-code-block=\"true\"], [data-image-block=\"true\"]')\n  )\n}\n\nfunction isProtectedEditorBlock(element: HTMLElement): boolean {\n  return element.dataset.codeBlock === 'true' || element.dataset.imageBlock === 'true'\n}\n\nfunction directEditorBlocks(editor: HTMLElement): HTMLElement[] {\n  return Array.from(editor.children).filter((child): child is HTMLElement => child instanceof HTMLElement)\n}\n\nfunction placeCaretFromEditorBackground(editor: HTMLElement, clientY: number): boolean {\n  const blocks = directEditorBlocks(editor)\n\n  if (blocks.length === 0) {\n    const paragraph = createCaretParagraph()\n    editor.append(paragraph)\n    editor.focus()\n    placeCaretAtStart(paragraph)\n    return true\n  }\n\n  const protectedAtY = blocks.find((block) => {\n    if (!isProtectedEditorBlock(block)) return false\n    const rect = block.getBoundingClientRect()\n    return clientY >= rect.top && clientY <= rect.bottom\n  })\n\n  if (protectedAtY) {\n    const next = protectedAtY.nextElementSibling\n    if (isEmptyCaretParagraph(next)) {\n      editor.focus()\n      placeCaretAtStart(next)\n      return false\n    }\n\n    const paragraph = createCaretParagraph()\n    protectedAtY.after(paragraph)\n    editor.focus()\n    placeCaretAtStart(paragraph)\n    return true\n  }\n\n  const nextIndex = blocks.findIndex((block) => clientY < block.getBoundingClientRect().top)\n\n  if (nextIndex === 0) {\n    const first = blocks[0]\n    if (isEmptyCaretParagraph(first)) {\n      editor.focus()\n      placeCaretAtStart(first)\n      return false\n    }\n\n    const paragraph = createCaretParagraph()\n    first.before(paragraph)\n    editor.focus()\n    placeCaretAtStart(paragraph)\n    return true\n  }\n\n  if (nextIndex > 0) {\n    const previous = blocks[nextIndex - 1]\n    const next = blocks[nextIndex]\n\n    if (isEmptyCaretParagraph(previous)) {\n      editor.focus()\n      placeCaretAtEnd(previous)\n      return false\n    }\n\n    if (isEmptyCaretParagraph(next)) {\n      editor.focus()\n      placeCaretAtStart(next)\n      return false\n    }\n\n    const paragraph = createCaretParagraph()\n    next.before(paragraph)\n    editor.focus()\n    placeCaretAtStart(paragraph)\n    return true\n  }\n\n  const last = blocks.at(-1)\n  if (last && isEmptyCaretParagraph(last)) {\n    editor.focus()\n    placeCaretAtStart(last)\n    return false\n  }\n\n  const paragraph = createCaretParagraph()\n  editor.append(paragraph)\n  editor.focus()\n  placeCaretAtStart(paragraph)\n  return true\n}\n\nfunction selectionIsInsideEditor(editor: HTMLElement, selection: Selection | null): selection is Selection {\n''',
)

replace_once(
    rich,
    '''    const link = linkFromTarget(editor, event.target)\n    if (!link) {\n      hideLinkPopover()\n      return\n    }\n''',
    '''    if (event.target === editor) {\n      hideLinkPopover()\n      event.preventDefault()\n      const insertedParagraph = placeCaretFromEditorBackground(editor, event.clientY)\n      if (insertedParagraph) emitChange()\n      syncToolbarState()\n      return\n    }\n\n    const link = linkFromTarget(editor, event.target)\n    if (!link) {\n      hideLinkPopover()\n      return\n    }\n''',
)

# 2) Code selection: only show native blue highlight when selection is genuinely local to code.
code = 'src/features/editor/CodeBlockEditor.tsx'
replace_once(
    code,
    '''    function handleKeyDown(event: KeyboardEvent) {\n      if (event.key === 'Escape' && activeDialog) {\n        event.preventDefault()\n        closeActiveDialog()\n      }\n    }\n\n    root.addEventListener('click', handleClick, true)\n    document.addEventListener('keydown', handleKeyDown)\n\n    return () => {\n      observer.disconnect()\n      root.removeEventListener('click', handleClick, true)\n      document.removeEventListener('keydown', handleKeyDown)\n      closeActiveDialog()\n    }\n''',
    '''    function syncCodeSelectionMode() {\n      root.querySelectorAll<HTMLElement>('[data-code-block=\"true\"]').forEach((block) => {\n        delete block.dataset.codeSelectionLocal\n      })\n\n      const selection = document.getSelection()\n      if (!selection || selection.rangeCount === 0) return\n\n      const elementFor = (node: Node | null): Element | null =>\n        node instanceof Element ? node : node?.parentElement ?? null\n      const anchorContent = elementFor(selection.anchorNode)?.closest<HTMLElement>('[data-code-content=\"true\"]') ?? null\n      const focusContent = elementFor(selection.focusNode)?.closest<HTMLElement>('[data-code-content=\"true\"]') ?? null\n\n      if (!anchorContent || anchorContent !== focusContent || !root.contains(anchorContent)) return\n      const block = anchorContent.closest<HTMLElement>('[data-code-block=\"true\"]')\n      if (block) block.dataset.codeSelectionLocal = 'true'\n    }\n\n    function handleKeyDown(event: KeyboardEvent) {\n      if (event.key === 'Escape' && activeDialog) {\n        event.preventDefault()\n        closeActiveDialog()\n      }\n    }\n\n    root.addEventListener('click', handleClick, true)\n    document.addEventListener('keydown', handleKeyDown)\n    document.addEventListener('selectionchange', syncCodeSelectionMode)\n    syncCodeSelectionMode()\n\n    return () => {\n      observer.disconnect()\n      root.removeEventListener('click', handleClick, true)\n      document.removeEventListener('keydown', handleKeyDown)\n      document.removeEventListener('selectionchange', syncCodeSelectionMode)\n      closeActiveDialog()\n    }\n''',
)

# 3) Selection visuals: atomic blocks stay visually neutral during a selection that starts outside them.
code_css = Path('src/features/editor/codeBlockEditor.css')
text = code_css.read_text(encoding='utf-8')
old = '''.code-block-editor-root .editor-surface > [data-code-block="true"],\n.code-block-editor-root .editor-code-block__content {\n  -webkit-user-select: none;\n  user-select: none;\n}\n\n.code-block-editor-root .editor-code-block:focus-within .editor-code-block__content {\n  -webkit-user-select: text;\n  user-select: text;\n}\n'''
new = '''.code-block-editor-root .editor-surface > [data-code-block="true"],\n.code-block-editor-root .editor-code-block__content {\n  -webkit-user-select: none;\n  user-select: none;\n}\n\n.code-block-editor-root .editor-surface > [data-code-block="true"]::selection,\n.code-block-editor-root .editor-surface > [data-code-block="true"] *::selection {\n  background: transparent;\n  color: inherit;\n}\n\n.code-block-editor-root .editor-code-block[data-code-selection-local="true"] .editor-code-block__content {\n  -webkit-user-select: text;\n  user-select: text;\n}\n\n.code-block-editor-root .editor-code-block[data-code-selection-local="true"] .editor-code-block__content::selection {\n  background: #2563eb;\n  color: #fff;\n}\n'''
if old not in text:
    raise SystemExit('Expected protected code selection CSS not found')
code_css.write_text(text.replace(old, new, 1), encoding='utf-8')

images_css = Path('src/features/images/images.css')
text = images_css.read_text(encoding='utf-8')
old = '''.image-note-editor-root .editor-surface > [data-image-block="true"] {\n  -webkit-user-select: none;\n  user-select: none;\n}\n\n.image-note-editor-root .editor-image-block__alt {\n  -webkit-user-select: text;\n  user-select: text;\n}\n'''
new = '''.image-note-editor-root .editor-surface > [data-image-block="true"] {\n  -webkit-user-select: none;\n  user-select: none;\n}\n\n.image-note-editor-root .editor-surface > [data-image-block="true"]::selection,\n.image-note-editor-root .editor-surface > [data-image-block="true"] *::selection {\n  background: transparent;\n  color: inherit;\n}\n\n.image-note-editor-root .editor-image-block__alt {\n  -webkit-user-select: text;\n  user-select: text;\n}\n\n.image-note-editor-root .editor-image-block__alt:focus::selection {\n  background: #2563eb;\n  color: #fff;\n}\n'''
if old not in text:
    raise SystemExit('Expected protected image selection CSS not found')
images_css.write_text(text.replace(old, new, 1), encoding='utf-8')

# Small affordance: blank editor space is intentionally writable.
editor_css = Path('src/features/editor/editor.css')
text = editor_css.read_text(encoding='utf-8')
old = '''  overflow-wrap: anywhere;\n}\n'''
new = '''  overflow-wrap: anywhere;\n  cursor: text;\n}\n'''
if old not in text:
    raise SystemExit('Expected editor surface CSS marker not found')
editor_css.write_text(text.replace(old, new, 1), encoding='utf-8')

# Document the repair.
changelog = Path('docs/CHANGELOG.md')
text = changelog.read_text(encoding='utf-8')
marker = '- Imágenes y bloques de código protegidos contra borrado accidental por selección global, Delete/Backspace, cortar, pegar o reemplazar texto; solo sus acciones explícitas pueden eliminarlos.\n'
addition = marker + '- Selección visual neutral para bloques protegidos y posicionamiento del cursor en espacios vacíos entre, al lado o después de imagen/código.\n'
if marker not in text:
    raise SystemExit('Expected changelog marker not found')
changelog.write_text(text.replace(marker, addition, 1), encoding='utf-8')
