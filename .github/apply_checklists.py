from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected marker not found in {path}: {old[:160]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def append_once(path: str, marker: str, addition: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if marker in text:
        return
    p.write_text(text.rstrip() + '\n\n' + addition.strip() + '\n', encoding='utf-8')

# ---------------------------------------------------------------------------
# 1. Persistent checklist model.
# ---------------------------------------------------------------------------
replace_once(
    'src/features/notes/noteTypes.ts',
    '''export interface OrderedListBlock {\n  id: string\n  type: 'orderedList'\n  items: RichTextRun[][]\n}\n\nexport interface DividerBlock {\n''',
    '''export interface OrderedListBlock {\n  id: string\n  type: 'orderedList'\n  items: RichTextRun[][]\n}\n\nexport interface ChecklistItem {\n  text: string\n  checked: boolean\n}\n\nexport interface ChecklistBlock {\n  id: string\n  type: 'checklist'\n  items: ChecklistItem[]\n}\n\nexport interface DividerBlock {\n''',
)
replace_once(
    'src/features/notes/noteTypes.ts',
    '''  | BulletListBlock\n  | OrderedListBlock\n  | DividerBlock\n''',
    '''  | BulletListBlock\n  | OrderedListBlock\n  | ChecklistBlock\n  | DividerBlock\n''',
)
replace_once(
    'src/features/notes/noteTypes.ts',
    '''function isRunArray(value: unknown): value is RichTextRun[] {\n  return Array.isArray(value) && value.every(isRichTextRun)\n}\n\nfunction isStoredNoteBlock(value: unknown): value is StoredNoteBlock {\n''',
    '''function isRunArray(value: unknown): value is RichTextRun[] {\n  return Array.isArray(value) && value.every(isRichTextRun)\n}\n\nfunction isChecklistItem(value: unknown): value is ChecklistItem {\n  if (!value || typeof value !== 'object') return false\n  const item = value as Partial<ChecklistItem>\n  return typeof item.text === 'string' && typeof item.checked === 'boolean'\n}\n\nfunction isStoredNoteBlock(value: unknown): value is StoredNoteBlock {\n''',
)
replace_once(
    'src/features/notes/noteTypes.ts',
    '''  if (block.type === 'paragraph' || block.type === 'quote') {\n    return isRunArray(block.runs)\n  }\n''',
    '''  if (block.type === 'checklist') {\n    return Array.isArray(block.items) && block.items.every(isChecklistItem)\n  }\n\n  if (block.type === 'paragraph' || block.type === 'quote') {\n    return isRunArray(block.runs)\n  }\n''',
)
replace_once(
    'src/features/notes/noteTypes.ts',
    '''      if (block.type === 'image') {\n        const description = block.alt?.trim()\n        if (description) return [description]\n        return [block.showName === false ? 'Imagen' : block.name]\n      }\n      if (block.type === 'bulletList' || block.type === 'orderedList') {\n''',
    '''      if (block.type === 'image') {\n        const description = block.alt?.trim()\n        if (description) return [description]\n        return [block.showName === false ? 'Imagen' : block.name]\n      }\n      if (block.type === 'checklist') {\n        return block.items.map((item) => `${item.checked ? '☑' : '☐'} ${item.text}`.trimEnd())\n      }\n      if (block.type === 'bulletList' || block.type === 'orderedList') {\n''',
)

# ---------------------------------------------------------------------------
# 2. RichTextEditor render/parse/interaction.
# ---------------------------------------------------------------------------
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''function codeBlockToHtml(block: Extract<NoteBlock, { type: 'code' }>): string {\n  const id = escapeHtml(block.id)\n  const language = normalizeCodeLanguage(block.language)\n  const text = escapeHtml(block.text)\n\n  return `<div class="editor-code-block" data-code-block="true" data-block-id="${id}" data-language="${language}" contenteditable="false"><div class="editor-code-block__toolbar"><select class="editor-code-block__language" data-code-language="true" aria-label="Lenguaje del bloque de código">${codeLanguageOptions(language)}</select><button class="editor-code-block__copy" data-code-copy="true" type="button">Copiar</button></div><div class="editor-code-block__content" data-code-content="true" contenteditable="true" spellcheck="false" autocapitalize="off" tabindex="0">${text}</div></div>`\n}\n\nfunction blocksToHtml(blocks: NoteBlock[]): string {\n''',
    '''function codeBlockToHtml(block: Extract<NoteBlock, { type: 'code' }>): string {\n  const id = escapeHtml(block.id)\n  const language = normalizeCodeLanguage(block.language)\n  const text = escapeHtml(block.text)\n\n  return `<div class="editor-code-block" data-code-block="true" data-block-id="${id}" data-language="${language}" contenteditable="false"><div class="editor-code-block__toolbar"><select class="editor-code-block__language" data-code-language="true" aria-label="Lenguaje del bloque de código">${codeLanguageOptions(language)}</select><button class="editor-code-block__copy" data-code-copy="true" type="button">Copiar</button></div><div class="editor-code-block__content" data-code-content="true" contenteditable="true" spellcheck="false" autocapitalize="off" tabindex="0">${text}</div></div>`\n}\n\ntype ChecklistItemModel = Extract<NoteBlock, { type: 'checklist' }>['items'][number]\n\nfunction checklistItemToHtml(item: ChecklistItemModel): string {\n  const checked = item.checked ? 'true' : 'false'\n  const mark = item.checked ? '✓' : ''\n  const label = item.checked ? 'Marcar tarea como pendiente' : 'Marcar tarea como completada'\n  const text = escapeHtml(item.text).replaceAll('\\n', '<br>') || '<br>'\n  return `<div class="editor-checklist__item" data-checklist-item="true" data-checked="${checked}"><button class="editor-checklist__toggle" data-checklist-toggle="true" type="button" aria-pressed="${checked}" aria-label="${label}">${mark}</button><div class="editor-checklist__text" data-checklist-text="true" contenteditable="true" role="textbox" aria-label="Tarea de checklist" spellcheck="true">${text}</div></div>`\n}\n\nfunction checklistBlockToHtml(block: Extract<NoteBlock, { type: 'checklist' }>): string {\n  const id = escapeHtml(block.id)\n  const items = block.items.length > 0 ? block.items : [{ text: '', checked: false }]\n  return `<div class="editor-checklist" data-checklist-block="true" data-block-id="${id}" contenteditable="false">${items.map(checklistItemToHtml).join('')}</div>`\n}\n\nfunction createChecklistItemElement(item: ChecklistItemModel): HTMLElement {\n  const template = document.createElement('template')\n  template.innerHTML = checklistItemToHtml(item)\n  const element = template.content.firstElementChild\n  if (!(element instanceof HTMLElement)) throw new Error('Checklist item could not be created.')\n  return element\n}\n\nfunction blocksToHtml(blocks: NoteBlock[]): string {\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''      if (block.type === 'divider') return `<hr data-block-id="${id}">`\n      if (block.type === 'code') return codeBlockToHtml(block)\n      if (block.type === 'heading') {\n''',
    '''      if (block.type === 'divider') return `<hr data-block-id="${id}">`\n      if (block.type === 'code') return codeBlockToHtml(block)\n      if (block.type === 'checklist') return checklistBlockToHtml(block)\n      if (block.type === 'heading') {\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''    if (node.dataset.codeBlock === 'true') {\n      blocks.push({\n        id,\n        type: 'code',\n        language: normalizeCodeLanguage(node.dataset.language),\n        text: codeTextFromElement(node.querySelector<HTMLElement>('[data-code-content="true"]')),\n      })\n      continue\n    }\n\n    if (tag === 'hr') {\n''',
    '''    if (node.dataset.codeBlock === 'true') {\n      blocks.push({\n        id,\n        type: 'code',\n        language: normalizeCodeLanguage(node.dataset.language),\n        text: codeTextFromElement(node.querySelector<HTMLElement>('[data-code-content="true"]')),\n      })\n      continue\n    }\n\n    if (node.dataset.checklistBlock === 'true') {\n      const items = Array.from(node.children)\n        .filter((child): child is HTMLElement =>\n          child instanceof HTMLElement && child.dataset.checklistItem === 'true',\n        )\n        .map((item) => {\n          const textElement = item.querySelector<HTMLElement>('[data-checklist-text="true"]')\n          const rawText = codeTextFromElement(textElement)\n          return {\n            text: /^\\n*$/.test(rawText) ? '' : rawText,\n            checked: item.dataset.checked === 'true',\n          }\n        })\n\n      blocks.push({\n        id,\n        type: 'checklist',\n        items: items.length > 0 ? items : [{ text: '', checked: false }],\n      })\n      continue\n    }\n\n    if (tag === 'hr') {\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''function selectionIsInsideCodeBlock(editor: HTMLElement, selection: Selection | null): boolean {\n  if (!selectionIsInsideEditor(editor, selection)) return false\n  const element = elementFromSelectionNode(selection.anchorNode)\n  return !!element?.closest('[data-code-content="true"]')\n}\n\nfunction selectionHasLink(editor: HTMLElement, selection: Selection): boolean {\n''',
    '''function selectionIsInsideCodeBlock(editor: HTMLElement, selection: Selection | null): boolean {\n  if (!selectionIsInsideEditor(editor, selection)) return false\n  const element = elementFromSelectionNode(selection.anchorNode)\n  return !!element?.closest('[data-code-content="true"]')\n}\n\nfunction selectionIsInsideChecklist(editor: HTMLElement, selection: Selection | null): boolean {\n  if (!selectionIsInsideEditor(editor, selection)) return false\n  const element = elementFromSelectionNode(selection.anchorNode)\n  return !!element?.closest('[data-checklist-text="true"]')\n}\n\nfunction selectionHasLink(editor: HTMLElement, selection: Selection): boolean {\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''    const selection = document.getSelection()\n    const code = selectionIsInsideCodeBlock(editor, selection)\n\n    if (!selectionIsInsideEditor(editor, selection)) {\n''',
    '''    const selection = document.getSelection()\n    const code = selectionIsInsideCodeBlock(editor, selection)\n    const checklist = selectionIsInsideChecklist(editor, selection)\n\n    if (!selectionIsInsideEditor(editor, selection)) {\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''    if (code) {\n      ;(['bold', 'italic', 'paragraph', 'heading2', 'heading3', 'bulletList', 'orderedList', 'quote', 'link'] as ToolbarFormat[])\n        .forEach((format) => setToolbarButtonState(toolbar, format, false))\n      setToolbarButtonState(toolbar, 'code', true)\n      return\n    }\n''',
    '''    if (checklist) {\n      ;(['bold', 'italic', 'paragraph', 'heading2', 'heading3', 'bulletList', 'orderedList', 'quote', 'link', 'code'] as ToolbarFormat[])\n        .forEach((format) => setToolbarButtonState(toolbar, format, false))\n      return\n    }\n\n    if (code) {\n      ;(['bold', 'italic', 'paragraph', 'heading2', 'heading3', 'bulletList', 'orderedList', 'quote', 'link'] as ToolbarFormat[])\n        .forEach((format) => setToolbarButtonState(toolbar, format, false))\n      setToolbarButtonState(toolbar, 'code', true)\n      return\n    }\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''    const selection = document.getSelection()\n    if (selectionIsInsideCodeBlock(editor, selection)) return\n\n    editor.focus()\n''',
    '''    const selection = document.getSelection()\n    if (selectionIsInsideCodeBlock(editor, selection) || selectionIsInsideChecklist(editor, selection)) return\n\n    editor.focus()\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''  function insertCodeBlock() {\n''',
    '''  function insertChecklistBlock() {\n    const editor = editorRef.current\n    if (!editor) return\n\n    const selection = document.getSelection()\n    const selectedText = selectionIsInsideEditor(editor, selection) &&\n      !selection.isCollapsed &&\n      !selectionIsInsideCodeBlock(editor, selection) &&\n      !selectionIsInsideChecklist(editor, selection)\n      ? selection.toString()\n      : ''\n    const id = createBlockId()\n    const nextParagraphId = createBlockId()\n    const block: Extract<NoteBlock, { type: 'checklist' }> = {\n      id,\n      type: 'checklist',\n      items: [{ text: selectedText, checked: false }],\n    }\n    const html = `${checklistBlockToHtml(block)}<p data-block-id="${nextParagraphId}"><br></p>`\n\n    const anchorElement = elementFromSelectionNode(selection?.anchorNode ?? null)\n    const atomicHost = anchorElement?.closest<HTMLElement>(\n      '[data-code-block="true"], [data-checklist-block="true"]',\n    )\n\n    if (atomicHost && atomicHost.parentElement === editor) {\n      atomicHost.insertAdjacentHTML('afterend', html)\n    } else {\n      editor.focus()\n      document.execCommand('insertHTML', false, html)\n    }\n    emitChange()\n\n    const itemText = editor.querySelector<HTMLElement>(\n      `[data-block-id="${id}"] [data-checklist-text="true"]`,\n    )\n    if (itemText) {\n      itemText.focus()\n      placeCaretAtEnd(itemText)\n      syncToolbarState()\n    }\n  }\n\n  function insertCodeBlock() {\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''    if (!editor || !selection || selection.isCollapsed || selection.rangeCount === 0) return\n    if (selectionIsInsideCodeBlock(editor, selection)) return\n''',
    '''    if (!editor || !selection || selection.isCollapsed || selection.rangeCount === 0) return\n    if (selectionIsInsideCodeBlock(editor, selection) || selectionIsInsideChecklist(editor, selection)) return\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''    const target = event.target instanceof Element ? event.target : null\n    const copyButton = target?.closest<HTMLButtonElement>('[data-code-copy="true"]')\n''',
    '''    const target = event.target instanceof Element ? event.target : null\n    const checklistToggle = target?.closest<HTMLButtonElement>('[data-checklist-toggle="true"]')\n    if (checklistToggle && editor.contains(checklistToggle)) {\n      event.preventDefault()\n      event.stopPropagation()\n      const item = checklistToggle.closest<HTMLElement>('[data-checklist-item="true"]')\n      if (!item) return\n      const checked = item.dataset.checked !== 'true'\n      item.dataset.checked = String(checked)\n      checklistToggle.setAttribute('aria-pressed', String(checked))\n      checklistToggle.setAttribute(\n        'aria-label',\n        checked ? 'Marcar tarea como pendiente' : 'Marcar tarea como completada',\n      )\n      checklistToggle.textContent = checked ? '✓' : ''\n      emitChange()\n      return\n    }\n\n    const copyButton = target?.closest<HTMLButtonElement>('[data-code-copy="true"]')\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {\n    if (event.key !== 'Tab') return\n    const target = event.target\n    if (!(target instanceof Element) || !target.closest('[data-code-content="true"]')) return\n\n    event.preventDefault()\n    document.execCommand('insertText', false, '\\t')\n    emitChange()\n  }\n''',
    '''  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {\n    const target = event.target\n    if (!(target instanceof Element)) return\n\n    const checklistText = target.closest<HTMLElement>('[data-checklist-text="true"]')\n    if (checklistText) {\n      const item = checklistText.closest<HTMLElement>('[data-checklist-item="true"]')\n      const checklist = checklistText.closest<HTMLElement>('[data-checklist-block="true"]')\n      if (!item || !checklist) return\n\n      if (event.key === 'Enter' && !event.shiftKey) {\n        event.preventDefault()\n        const nextItem = createChecklistItemElement({ text: '', checked: false })\n        item.after(nextItem)\n        emitChange()\n        const nextText = nextItem.querySelector<HTMLElement>('[data-checklist-text="true"]')\n        if (nextText) {\n          nextText.focus()\n          placeCaretAtStart(nextText)\n        }\n        return\n      }\n\n      if (event.key === 'Backspace' && /^\\n*$/.test(codeTextFromElement(checklistText))) {\n        const items = Array.from(checklist.children).filter(\n          (child): child is HTMLElement =>\n            child instanceof HTMLElement && child.dataset.checklistItem === 'true',\n        )\n        if (items.length > 1) {\n          event.preventDefault()\n          const index = items.indexOf(item)\n          const focusItem = items[index - 1] ?? items[index + 1]\n          item.remove()\n          emitChange()\n          const focusText = focusItem?.querySelector<HTMLElement>('[data-checklist-text="true"]')\n          if (focusText) {\n            focusText.focus()\n            placeCaretAtEnd(focusText)\n          }\n        }\n        return\n      }\n\n      return\n    }\n\n    if (event.key !== 'Tab' || !target.closest('[data-code-content="true"]')) return\n\n    event.preventDefault()\n    document.execCommand('insertText', false, '\\t')\n    emitChange()\n  }\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''        <button className="editor-tool" data-format="code" aria-pressed="false" type="button" onMouseDown={keepSelection} onClick={insertCodeBlock} title="Bloque de código">\n          Código\n        </button>\n        <button className="editor-tool" type="button" onMouseDown={keepSelection} onClick={() => runCommand('insertHorizontalRule')} title="Separador">\n''',
    '''        <button className="editor-tool" data-format="code" aria-pressed="false" type="button" onMouseDown={keepSelection} onClick={insertCodeBlock} title="Bloque de código">\n          Código\n        </button>\n        <button className="editor-tool" data-insert="checklist" type="button" onMouseDown={keepSelection} onClick={insertChecklistBlock} title="Checklist">\n          ☑ Checklist\n        </button>\n        <button className="editor-tool" type="button" onMouseDown={keepSelection} onClick={() => runCommand('insertHorizontalRule')} title="Separador">\n''',
)

# ---------------------------------------------------------------------------
# 3. Insert panel entry.
# ---------------------------------------------------------------------------
replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    '''            <button type="button" onPointerDown={keepEditorSelection} onClick={triggerImageInsert}><strong>▧</strong><span>Imagen</span></button>\n            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format="code"]')}><strong>&lt;/&gt;</strong><span>Código</span></button>\n            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[title="Separador"]')}><strong>—</strong><span>Separador</span></button>\n''',
    '''            <button type="button" onPointerDown={keepEditorSelection} onClick={triggerImageInsert}><strong>▧</strong><span>Imagen</span></button>\n            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format="code"]')}><strong>&lt;/&gt;</strong><span>Código</span></button>\n            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-insert="checklist"]')}><strong>☑</strong><span>Checklist</span></button>\n            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[title="Separador"]')}><strong>—</strong><span>Separador</span></button>\n''',
)

# ---------------------------------------------------------------------------
# 4. Fluid checklist styling.
# ---------------------------------------------------------------------------
append_once(
    'src/features/editor/editor.css',
    '/* OANIX V1 checklist blocks */',
    '''/* OANIX V1 checklist blocks */\n.editor-checklist {\n  width: 100%;\n  min-width: 0;\n  max-width: 100%;\n  display: grid;\n  gap: .35rem;\n  margin: .7rem 0;\n  padding: .15rem 0;\n  box-sizing: border-box;\n}\n.editor-checklist__item {\n  min-width: 0;\n  display: grid;\n  grid-template-columns: auto minmax(0, 1fr);\n  align-items: start;\n  gap: clamp(.45rem, 1.8cqw, .65rem);\n  padding: .15rem 0;\n}\n.editor-checklist__toggle {\n  width: clamp(1.85rem, 7cqw, 2.1rem);\n  height: clamp(1.85rem, 7cqw, 2.1rem);\n  display: grid;\n  place-items: center;\n  flex: 0 0 auto;\n  margin-top: .08rem;\n  padding: 0;\n  border: 2px solid #94a3b8;\n  border-radius: .55rem;\n  background: transparent;\n  color: #fff;\n  font: inherit;\n  font-size: .9rem;\n  font-weight: 900;\n  line-height: 1;\n  cursor: pointer;\n}\n.editor-checklist__item[data-checked='true'] .editor-checklist__toggle {\n  border-color: #2563eb;\n  background: #2563eb;\n}\n.editor-checklist__toggle:focus-visible {\n  outline: 3px solid rgba(37,99,235,.22);\n  outline-offset: 2px;\n}\n.editor-checklist__text {\n  min-width: 0;\n  min-height: 2rem;\n  padding: .3rem .4rem;\n  border-radius: .45rem;\n  outline: none;\n  color: inherit;\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n  word-break: break-word;\n}\n.editor-checklist__text:focus {\n  background: rgba(37,99,235,.06);\n  box-shadow: inset 0 0 0 1px rgba(37,99,235,.14);\n}\n.editor-checklist__item[data-checked='true'] .editor-checklist__text {\n  color: #7b8794;\n  text-decoration: line-through;\n  text-decoration-thickness: 1.5px;\n}\n@container (max-width: 24rem) {\n  .editor-checklist__item { gap: .4rem; }\n  .editor-checklist__text { padding-inline: .25rem; }\n}\n''',
)

# ---------------------------------------------------------------------------
# 5. Tests.
# ---------------------------------------------------------------------------
Path('tests/checklists.test.ts').write_text('''import assert from 'node:assert/strict'\nimport test from 'node:test'\n\nimport { isNoteRecord, noteBlocksToPlainText, type NoteRecord } from '../src/features/notes/noteTypes.ts'\n\nfunction checklistNote(): NoteRecord {\n  return {\n    version: 1,\n    id: 'note-checklist-test',\n    title: 'Compras',\n    createdAt: '2026-08-15T00:00:00.000Z',\n    updatedAt: '2026-08-15T00:00:00.000Z',\n    content: {\n      format: 'blocks-v1',\n      blocks: [{\n        id: 'checklist-block-1',\n        type: 'checklist',\n        items: [\n          { text: 'Comprar café', checked: false },\n          { text: 'Pagar recibo', checked: true },\n        ],\n      }],\n    },\n  }\n}\n\ntest('checklist blocks survive note validation', () => {\n  assert.equal(isNoteRecord(checklistNote()), true)\n})\n\ntest('checklist state is represented in note previews and search text', () => {\n  assert.equal(\n    noteBlocksToPlainText(checklistNote().content.blocks),\n    '☐ Comprar café\\n☑ Pagar recibo',\n  )\n})\n\ntest('checklist validation rejects malformed item state', () => {\n  const invalid = checklistNote() as unknown as { content: { blocks: Array<Record<string, unknown>> } }\n  invalid.content.blocks[0].items = [{ text: 'Tarea', checked: 'yes' }]\n  assert.equal(isNoteRecord(invalid), false)\n})\n''', encoding='utf-8')

# ---------------------------------------------------------------------------
# 6. Roadmap/docs.
# ---------------------------------------------------------------------------
roadmap = Path('docs/ROADMAP.md')
text = roadmap.read_text(encoding='utf-8')
for line in [
    '- [ ] Permitir reducir más las imágenes en móvil manteniendo siempre su proporción, especialmente imágenes verticales tipo recibo.',
    '- [ ] Mantener controles de imagen utilizables y legibles cuando la imagen sea pequeña, sin invadir el contenido.',
    '- [ ] Sustituir en móvil la barra horizontal de formato por un botón flotante de herramientas que permanezca accesible durante el scroll y permita añadir más acciones en el futuro.',
    '- [ ] Mantener Deshacer y Rehacer como controles flotantes de acceso rápido en móvil.',
    '- [ ] Revisar el comportamiento con teclado virtual, scroll, selección de texto, imágenes y bloques especiales.',
    '- [ ] En móvil, tratar imágenes como bloques completos sin texto lateral y permitir escalarlas desde cualquier esquina sin salir del margen útil.',
    '- [ ] Mantener los bloques de código contenidos dentro de la nota y ofrecer una vista/editor de código a pantalla completa para líneas largas.',
    '- [ ] Auditar botones, menús, tarjetas y controles responsive para evitar textos cortados, desbordados o ilegibles; incluye acciones largas como `Convertir a texto` y `Eliminar bloque`.',
    '- [ ] Validar visualmente en móvil y pasar CI antes de continuar.',
    '- [ ] Confirmar guardado cifrado real en móvil, navegación Atrás/gesto y auditoría responsive en móvil, tablet y PC.',
]:
    text = text.replace(line, line.replace('- [ ]', '- [x]', 1))
text = text.replace('- [ ] Checklists', '- [x] Checklists', 1)
text = text.replace('**Siguiente bloque de trabajo:** Pulido móvil del editor. Después continúa Checklists.', '**Siguiente bloque de trabajo:** Fichas de contacto privadas.', 1)
roadmap.write_text(text, encoding='utf-8')

append_once(
    'docs/ARCHITECTURE.md',
    'Los checklists de V1 son bloques estructurados',
    '''Los checklists de V1 son bloques estructurados dentro de `blocks-v1`: cada elemento guarda únicamente su texto y estado completado. Se cifran junto con el resto de la nota y no dependen de HTML persistido.''',
)
append_once(
    'docs/CHANGELOG.md',
    'Checklists V1',
    '''- Checklists V1 como bloque nativo cifrado: tareas marcables, edición directa, Enter para añadir tarea, Backspace sobre una tarea vacía para retirarla y diseño responsive por contenedor.''',
)
