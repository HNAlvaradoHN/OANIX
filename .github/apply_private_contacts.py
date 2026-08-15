from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected marker not found in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def append_once(path: str, marker: str, addition: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if marker in text:
        return
    p.write_text(text.rstrip() + '\n\n' + addition.strip() + '\n', encoding='utf-8')

# ---------------------------------------------------------------------------
# Persistent contact block inside blocks-v1.
# ---------------------------------------------------------------------------
replace_once(
    'src/features/notes/noteTypes.ts',
    '''export interface ChecklistBlock {\n  id: string\n  type: 'checklist'\n  items: ChecklistItem[]\n}\n\nexport interface DividerBlock {\n''',
    '''export interface ChecklistBlock {\n  id: string\n  type: 'checklist'\n  items: ChecklistItem[]\n}\n\nexport interface ContactBlock {\n  id: string\n  type: 'contact'\n  name: string\n  phone: string\n  email: string\n  organization: string\n  notes: string\n}\n\nexport interface DividerBlock {\n''',
)
replace_once(
    'src/features/notes/noteTypes.ts',
    '''  | OrderedListBlock\n  | ChecklistBlock\n  | DividerBlock\n''',
    '''  | OrderedListBlock\n  | ChecklistBlock\n  | ContactBlock\n  | DividerBlock\n''',
)
replace_once(
    'src/features/notes/noteTypes.ts',
    '''    showName?: unknown\n  }\n''',
    '''    showName?: unknown\n    phone?: unknown\n    email?: unknown\n    organization?: unknown\n    notes?: unknown\n  }\n''',
)
replace_once(
    'src/features/notes/noteTypes.ts',
    '''  if (block.type === 'checklist') {\n    return Array.isArray(block.items) && block.items.every(isChecklistItem)\n  }\n\n  if (block.type === 'paragraph' || block.type === 'quote') {\n''',
    '''  if (block.type === 'checklist') {\n    return Array.isArray(block.items) && block.items.every(isChecklistItem)\n  }\n\n  if (block.type === 'contact') {\n    return (\n      typeof block.name === 'string' &&\n      typeof block.phone === 'string' &&\n      typeof block.email === 'string' &&\n      typeof block.organization === 'string' &&\n      typeof block.notes === 'string'\n    )\n  }\n\n  if (block.type === 'paragraph' || block.type === 'quote') {\n''',
)
replace_once(
    'src/features/notes/noteTypes.ts',
    '''      if (block.type === 'checklist') {\n        return block.items.map((item) => `${item.checked ? '☑' : '☐'} ${item.text}`.trimEnd())\n      }\n      if (block.type === 'bulletList' || block.type === 'orderedList') {\n''',
    '''      if (block.type === 'checklist') {\n        return block.items.map((item) => `${item.checked ? '☑' : '☐'} ${item.text}`.trimEnd())\n      }\n      if (block.type === 'contact') {\n        return [block.name, block.phone, block.email, block.organization, block.notes]\n          .map((value) => value.trim())\n          .filter(Boolean)\n      }\n      if (block.type === 'bulletList' || block.type === 'orderedList') {\n''',
)

# ---------------------------------------------------------------------------
# Rich editor render / parse / insertion / editing.
# ---------------------------------------------------------------------------
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''  type ClipboardEvent,\n  type KeyboardEvent as ReactKeyboardEvent,\n''',
    '''  type ClipboardEvent,\n  type FormEvent as ReactFormEvent,\n  type KeyboardEvent as ReactKeyboardEvent,\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''function createChecklistItemElement(item: ChecklistItemModel): HTMLElement {\n  const template = document.createElement('template')\n  template.innerHTML = checklistItemToHtml(item)\n  const element = template.content.firstElementChild\n  if (!(element instanceof HTMLElement)) throw new Error('Checklist item could not be created.')\n  return element\n}\n\nfunction blocksToHtml(blocks: NoteBlock[]): string {\n''',
    '''function createChecklistItemElement(item: ChecklistItemModel): HTMLElement {\n  const template = document.createElement('template')\n  template.innerHTML = checklistItemToHtml(item)\n  const element = template.content.firstElementChild\n  if (!(element instanceof HTMLElement)) throw new Error('Checklist item could not be created.')\n  return element\n}\n\nfunction contactInitial(name: string): string {\n  return name.trim().charAt(0).toLocaleUpperCase() || 'C'\n}\n\nfunction contactBlockToHtml(block: Extract<NoteBlock, { type: 'contact' }>): string {\n  const id = escapeHtml(block.id)\n  const initial = escapeHtml(contactInitial(block.name))\n  return `<div class=\"editor-contact-card\" data-contact-block=\"true\" data-block-id=\"${id}\" contenteditable=\"false\"><div class=\"editor-contact-card__header\"><div class=\"editor-contact-card__avatar\" data-contact-avatar=\"true\" aria-hidden=\"true\">${initial}</div><div class=\"editor-contact-card__title\"><strong>Contacto privado</strong><span>Cifrado dentro de esta nota</span></div><button class=\"editor-contact-card__remove\" data-contact-remove=\"true\" type=\"button\">Eliminar</button></div><div class=\"editor-contact-card__fields\"><label class=\"editor-contact-card__field\"><span>Nombre</span><input data-contact-field=\"name\" type=\"text\" value=\"${escapeHtml(block.name)}\" autocomplete=\"off\"></label><label class=\"editor-contact-card__field\"><span>Teléfono</span><input data-contact-field=\"phone\" type=\"tel\" value=\"${escapeHtml(block.phone)}\" autocomplete=\"off\" inputmode=\"tel\"></label><label class=\"editor-contact-card__field\"><span>Correo</span><input data-contact-field=\"email\" type=\"email\" value=\"${escapeHtml(block.email)}\" autocomplete=\"off\" autocapitalize=\"none\" spellcheck=\"false\"></label><label class=\"editor-contact-card__field\"><span>Organización</span><input data-contact-field=\"organization\" type=\"text\" value=\"${escapeHtml(block.organization)}\" autocomplete=\"off\"></label><label class=\"editor-contact-card__field editor-contact-card__field--notes\"><span>Notas</span><textarea data-contact-field=\"notes\" rows=\"3\" autocomplete=\"off\">${escapeHtml(block.notes)}</textarea></label></div></div>`\n}\n\nfunction contactFieldValue(block: HTMLElement, name: string): string {\n  const field = block.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-contact-field=\"${name}\"]`)\n  return field?.value ?? ''\n}\n\nfunction blocksToHtml(blocks: NoteBlock[]): string {\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''      if (block.type === 'code') return codeBlockToHtml(block)\n      if (block.type === 'checklist') return checklistBlockToHtml(block)\n      if (block.type === 'heading') {\n''',
    '''      if (block.type === 'code') return codeBlockToHtml(block)\n      if (block.type === 'checklist') return checklistBlockToHtml(block)\n      if (block.type === 'contact') return contactBlockToHtml(block)\n      if (block.type === 'heading') {\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''    if (node.dataset.checklistBlock === 'true') {\n      const items = Array.from(node.children)\n''',
    '''    if (node.dataset.contactBlock === 'true') {\n      blocks.push({\n        id,\n        type: 'contact',\n        name: contactFieldValue(node, 'name'),\n        phone: contactFieldValue(node, 'phone'),\n        email: contactFieldValue(node, 'email'),\n        organization: contactFieldValue(node, 'organization'),\n        notes: contactFieldValue(node, 'notes'),\n      })\n      continue\n    }\n\n    if (node.dataset.checklistBlock === 'true') {\n      const items = Array.from(node.children)\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''function selectionIsInsideChecklist(editor: HTMLElement, selection: Selection | null): boolean {\n  if (!selectionIsInsideEditor(editor, selection)) return false\n  const element = elementFromSelectionNode(selection.anchorNode)\n  return !!element?.closest('[data-checklist-text=\"true\"]')\n}\n\nfunction selectionHasLink(editor: HTMLElement, selection: Selection): boolean {\n''',
    '''function selectionIsInsideChecklist(editor: HTMLElement, selection: Selection | null): boolean {\n  if (!selectionIsInsideEditor(editor, selection)) return false\n  const element = elementFromSelectionNode(selection.anchorNode)\n  return !!element?.closest('[data-checklist-text=\"true\"]')\n}\n\nfunction isEditingContact(editor: HTMLElement): boolean {\n  const active = document.activeElement\n  return active instanceof Element && editor.contains(active) && !!active.closest('[data-contact-block=\"true\"]')\n}\n\nfunction atomicHostForInsertion(editor: HTMLElement, selection: Selection | null): HTMLElement | null {\n  const active = document.activeElement\n  if (active instanceof Element && editor.contains(active)) {\n    const activeHost = active.closest<HTMLElement>(\n      '[data-code-block=\"true\"], [data-checklist-block=\"true\"], [data-contact-block=\"true\"]',\n    )\n    if (activeHost?.parentElement === editor) return activeHost\n  }\n\n  const anchorElement = elementFromSelectionNode(selection?.anchorNode ?? null)\n  const selectionHost = anchorElement?.closest<HTMLElement>(\n    '[data-code-block=\"true\"], [data-checklist-block=\"true\"], [data-contact-block=\"true\"]',\n  )\n  return selectionHost?.parentElement === editor ? selectionHost : null\n}\n\nfunction selectionHasLink(editor: HTMLElement, selection: Selection): boolean {\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''    const code = selectionIsInsideCodeBlock(editor, selection)\n    const checklist = selectionIsInsideChecklist(editor, selection)\n\n    if (!selectionIsInsideEditor(editor, selection)) {\n''',
    '''    const code = selectionIsInsideCodeBlock(editor, selection)\n    const checklist = selectionIsInsideChecklist(editor, selection)\n    const contact = isEditingContact(editor)\n\n    if (contact) {\n      ;(['bold', 'italic', 'paragraph', 'heading2', 'heading3', 'bulletList', 'orderedList', 'quote', 'link', 'code'] as ToolbarFormat[])\n        .forEach((format) => setToolbarButtonState(toolbar, format, false))\n      return\n    }\n\n    if (!selectionIsInsideEditor(editor, selection)) {\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''    const selection = document.getSelection()\n    if (selectionIsInsideCodeBlock(editor, selection) || selectionIsInsideChecklist(editor, selection)) return\n\n    editor.focus()\n''',
    '''    const selection = document.getSelection()\n    if (selectionIsInsideCodeBlock(editor, selection) || selectionIsInsideChecklist(editor, selection) || isEditingContact(editor)) return\n\n    editor.focus()\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''    const anchorElement = elementFromSelectionNode(selection?.anchorNode ?? null)\n    const atomicHost = anchorElement?.closest<HTMLElement>(\n      '[data-code-block=\"true\"], [data-checklist-block=\"true\"]',\n    )\n\n    if (atomicHost && atomicHost.parentElement === editor) {\n''',
    '''    const atomicHost = atomicHostForInsertion(editor, selection)\n\n    if (atomicHost) {\n''',
)
# insertChecklistBlock only; insertCode is adjusted separately below.
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''  function insertCodeBlock() {\n    const editor = editorRef.current\n    if (!editor) return\n\n    const selection = document.getSelection()\n    const selectedText = selectionIsInsideEditor(editor, selection) && !selection.isCollapsed\n      ? selection.toString()\n      : ''\n    const id = createBlockId()\n    const nextParagraphId = createBlockId()\n    const block: Extract<NoteBlock, { type: 'code' }> = {\n      id,\n      type: 'code',\n      language: 'plaintext',\n      text: selectedText,\n    }\n\n    editor.focus()\n    document.execCommand(\n      'insertHTML',\n      false,\n      `${codeBlockToHtml(block)}<p data-block-id=\"${nextParagraphId}\"><br></p>`,\n    )\n    emitChange()\n''',
    '''  function insertContactBlock() {\n    const editor = editorRef.current\n    if (!editor) return\n\n    const selection = document.getSelection()\n    const id = createBlockId()\n    const nextParagraphId = createBlockId()\n    const block: Extract<NoteBlock, { type: 'contact' }> = {\n      id,\n      type: 'contact',\n      name: '',\n      phone: '',\n      email: '',\n      organization: '',\n      notes: '',\n    }\n    const html = `${contactBlockToHtml(block)}<p data-block-id=\"${nextParagraphId}\"><br></p>`\n    const atomicHost = atomicHostForInsertion(editor, selection)\n\n    if (atomicHost) {\n      atomicHost.insertAdjacentHTML('afterend', html)\n    } else {\n      editor.focus()\n      document.execCommand('insertHTML', false, html)\n    }\n    emitChange()\n\n    const nameField = editor.querySelector<HTMLInputElement>(\n      `[data-block-id=\"${id}\"] [data-contact-field=\"name\"]`,\n    )\n    nameField?.focus()\n    syncToolbarState()\n  }\n\n  function insertCodeBlock() {\n    const editor = editorRef.current\n    if (!editor) return\n\n    const selection = document.getSelection()\n    const selectedText = selectionIsInsideEditor(editor, selection) && !selection.isCollapsed && !isEditingContact(editor)\n      ? selection.toString()\n      : ''\n    const id = createBlockId()\n    const nextParagraphId = createBlockId()\n    const block: Extract<NoteBlock, { type: 'code' }> = {\n      id,\n      type: 'code',\n      language: 'plaintext',\n      text: selectedText,\n    }\n    const html = `${codeBlockToHtml(block)}<p data-block-id=\"${nextParagraphId}\"><br></p>`\n    const atomicHost = atomicHostForInsertion(editor, selection)\n\n    if (atomicHost) {\n      atomicHost.insertAdjacentHTML('afterend', html)\n    } else {\n      editor.focus()\n      document.execCommand('insertHTML', false, html)\n    }\n    emitChange()\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''    if (selectionIsInsideCodeBlock(editor, selection) || selectionIsInsideChecklist(editor, selection)) return\n''',
    '''    if (selectionIsInsideCodeBlock(editor, selection) || selectionIsInsideChecklist(editor, selection) || isEditingContact(editor)) return\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''    const target = event.target instanceof Element ? event.target : null\n    const checklistToggle = target?.closest<HTMLButtonElement>('[data-checklist-toggle=\"true\"]')\n''',
    '''    const target = event.target instanceof Element ? event.target : null\n    const contactRemove = target?.closest<HTMLButtonElement>('[data-contact-remove=\"true\"]')\n    if (contactRemove && editor.contains(contactRemove)) {\n      event.preventDefault()\n      event.stopPropagation()\n      const contact = contactRemove.closest<HTMLElement>('[data-contact-block=\"true\"]')\n      if (!contact) return\n      if (!window.confirm('¿Eliminar esta ficha de contacto privada?')) return\n      contact.remove()\n      emitChange()\n      return\n    }\n\n    const checklistToggle = target?.closest<HTMLButtonElement>('[data-checklist-toggle=\"true\"]')\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {\n    const plainText = event.clipboardData.getData('text/plain')\n''',
    '''  function handleEditorInput(event: ReactFormEvent<HTMLDivElement>) {\n    const target = event.target\n    if (target instanceof HTMLInputElement && target.dataset.contactField) {\n      target.setAttribute('value', target.value)\n      if (target.dataset.contactField === 'name') {\n        const card = target.closest<HTMLElement>('[data-contact-block=\"true\"]')\n        const avatar = card?.querySelector<HTMLElement>('[data-contact-avatar=\"true\"]')\n        if (avatar) avatar.textContent = contactInitial(target.value)\n      }\n    } else if (target instanceof HTMLTextAreaElement && target.dataset.contactField) {\n      target.defaultValue = target.value\n    }\n    emitChange()\n  }\n\n  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {\n    const target = event.target\n    if (target instanceof Element && target.closest('[data-contact-field]')) return\n\n    const plainText = event.clipboardData.getData('text/plain')\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''    const checklistText = target.closest<HTMLElement>('[data-checklist-text=\"true\"]')\n''',
    '''    const contactField = target.closest<HTMLInputElement | HTMLTextAreaElement>('[data-contact-field]')\n    if (contactField) {\n      if (event.key === 'Enter' && contactField instanceof HTMLInputElement) {\n        event.preventDefault()\n        const card = contactField.closest<HTMLElement>('[data-contact-block=\"true\"]')\n        const fields = card\n          ? Array.from(card.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-contact-field]'))\n          : []\n        const next = fields[fields.indexOf(contactField) + 1]\n        next?.focus()\n      }\n      return\n    }\n\n    const checklistText = target.closest<HTMLElement>('[data-checklist-text=\"true\"]')\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''        <button className=\"editor-tool\" data-insert=\"checklist\" type=\"button\" onMouseDown={keepSelection} onClick={insertChecklistBlock} title=\"Checklist\">\n          ☑ Checklist\n        </button>\n        <button className=\"editor-tool\" type=\"button\" onMouseDown={keepSelection} onClick={() => runCommand('insertHorizontalRule')} title=\"Separador\">\n''',
    '''        <button className=\"editor-tool\" data-insert=\"checklist\" type=\"button\" onMouseDown={keepSelection} onClick={insertChecklistBlock} title=\"Checklist\">\n          ☑ Checklist\n        </button>\n        <button className=\"editor-tool\" data-insert=\"contact\" type=\"button\" onMouseDown={keepSelection} onClick={insertContactBlock} title=\"Contacto privado\">\n          ◉ Contacto\n        </button>\n        <button className=\"editor-tool\" type=\"button\" onMouseDown={keepSelection} onClick={() => runCommand('insertHorizontalRule')} title=\"Separador\">\n''',
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    '''        onInput={emitChange}\n''',
    '''        onInput={handleEditorInput}\n''',
)

# ---------------------------------------------------------------------------
# Insert panel integration.
# ---------------------------------------------------------------------------
replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    '''            <button type=\"button\" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-insert=\"checklist\"]')}><strong>☑</strong><span>Checklist</span></button>\n            <button type=\"button\" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[title=\"Separador\"]')}><strong>—</strong><span>Separador</span></button>\n''',
    '''            <button type=\"button\" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-insert=\"checklist\"]')}><strong>☑</strong><span>Checklist</span></button>\n            <button type=\"button\" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-insert=\"contact\"]')}><strong>◉</strong><span>Contacto</span></button>\n            <button type=\"button\" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[title=\"Separador\"]')}><strong>—</strong><span>Separador</span></button>\n''',
)

# ---------------------------------------------------------------------------
# Fluid contact-card styling. Theme follows current text color instead of
# branching into separate mobile/tablet/desktop implementations.
# ---------------------------------------------------------------------------
append_once(
    'src/features/editor/editor.css',
    '/* OANIX V1 private contact cards */',
    '''/* OANIX V1 private contact cards */
.editor-contact-card {
  container-type: inline-size;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  display: grid;
  gap: clamp(.75rem, 2.4cqw, 1rem);
  margin: 1rem 0;
  padding: clamp(.8rem, 2.8cqw, 1.1rem);
  border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
  border-radius: clamp(.85rem, 2.5cqw, 1.15rem);
  background: color-mix(in srgb, currentColor 4%, transparent);
  color: inherit;
}
.editor-contact-card__header {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: .7rem;
}
.editor-contact-card__avatar {
  width: clamp(2.5rem, 10cqw, 3.15rem);
  height: clamp(2.5rem, 10cqw, 3.15rem);
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #315efb;
  color: #fff;
  font-size: clamp(1rem, 4cqw, 1.25rem);
  font-weight: 900;
  line-height: 1;
}
.editor-contact-card__title {
  min-width: 0;
  display: grid;
  gap: .05rem;
  flex: 1 1 auto;
}
.editor-contact-card__title strong {
  min-width: 0;
  color: inherit;
  font-size: clamp(.9rem, 3cqw, 1rem);
  overflow-wrap: anywhere;
}
.editor-contact-card__title span {
  opacity: .62;
  font-size: clamp(.68rem, 2.2cqw, .76rem);
}
.editor-contact-card__remove {
  flex: 0 0 auto;
  min-height: 2.2rem;
  padding: .35rem .6rem;
  border: 0;
  border-radius: .65rem;
  background: transparent;
  color: #dc2626;
  font: inherit;
  font-size: .72rem;
  font-weight: 800;
  cursor: pointer;
}
.editor-contact-card__remove:hover,
.editor-contact-card__remove:focus-visible {
  outline: none;
  background: rgba(220,38,38,.09);
}
.editor-contact-card__fields {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(.55rem, 2cqw, .8rem);
}
.editor-contact-card__field {
  min-width: 0;
  display: grid;
  gap: .28rem;
}
.editor-contact-card__field > span {
  opacity: .66;
  font-size: .7rem;
  font-weight: 800;
  letter-spacing: .02em;
}
.editor-contact-card__field input,
.editor-contact-card__field textarea {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: .68rem .72rem;
  border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  border-radius: .7rem;
  outline: none;
  background: color-mix(in srgb, currentColor 3%, transparent);
  color: inherit;
  -webkit-text-fill-color: currentColor;
  font: inherit;
  font-size: clamp(.82rem, 2.7cqw, .92rem);
  line-height: 1.35;
}
.editor-contact-card__field textarea {
  min-height: 5.5rem;
  resize: vertical;
}
.editor-contact-card__field input:focus,
.editor-contact-card__field textarea:focus {
  border-color: #4f7df3;
  box-shadow: 0 0 0 3px rgba(49,94,251,.12);
}
.editor-contact-card__field--notes { grid-column: 1 / -1; }
@container (max-width: 30rem) {
  .editor-contact-card__fields { grid-template-columns: minmax(0, 1fr); }
  .editor-contact-card__field--notes { grid-column: auto; }
  .editor-contact-card__header { align-items: flex-start; }
  .editor-contact-card__remove { margin-left: auto; }
}
@container (max-width: 20rem) {
  .editor-contact-card__header { flex-wrap: wrap; }
  .editor-contact-card__remove { width: 100%; }
}''',
)

# ---------------------------------------------------------------------------
# Tests and docs.
# ---------------------------------------------------------------------------
Path('tests/contactBlocks.test.ts').write_text('''import assert from 'node:assert/strict'\nimport test from 'node:test'\n\nimport { isNoteRecord, noteBlocksToPlainText, type NoteRecord } from '../src/features/notes/noteTypes.ts'\n\nfunction contactNote(): NoteRecord {\n  return {\n    version: 1,\n    id: 'note-contact-test',\n    title: 'Contacto',\n    createdAt: '2026-08-15T00:00:00.000Z',\n    updatedAt: '2026-08-15T00:00:00.000Z',\n    content: {\n      format: 'blocks-v1',\n      blocks: [{\n        id: 'contact-block-1',\n        type: 'contact',\n        name: 'Ana López',\n        phone: '+504 9999-0000',\n        email: 'ana@example.com',\n        organization: 'OANIX',\n        notes: 'Contacto de prueba',\n      }],\n    },\n  }\n}\n\ntest('private contact blocks survive note validation', () => {\n  assert.equal(isNoteRecord(contactNote()), true)\n})\n\ntest('contact fields are available to local previews and future search', () => {\n  assert.equal(\n    noteBlocksToPlainText(contactNote().content.blocks),\n    'Ana López\\n+504 9999-0000\\nana@example.com\\nOANIX\\nContacto de prueba',\n  )\n})\n\ntest('contact validation rejects malformed fields', () => {\n  const invalid = contactNote() as unknown as { content: { blocks: Array<Record<string, unknown>> } }\n  invalid.content.blocks[0].phone = 50499990000\n  assert.equal(isNoteRecord(invalid), false)\n})\n\ntest('empty optional contact text remains a valid private card', () => {\n  const note = contactNote()\n  const block = note.content.blocks[0]\n  if (block.type !== 'contact') throw new Error('Expected contact block')\n  block.phone = ''\n  block.email = ''\n  block.organization = ''\n  block.notes = ''\n  assert.equal(isNoteRecord(note), true)\n  assert.equal(noteBlocksToPlainText(note.content.blocks), 'Ana López')\n})\n''', encoding='utf-8')

replace_once('docs/ROADMAP.md', '- [ ] Fichas de contacto privadas\n- [ ] Carpetas\n', '- [x] Fichas de contacto privadas\n- [ ] Carpetas\n')
replace_once('docs/ROADMAP.md', '**Siguiente bloque de trabajo:** Fichas de contacto privadas.', '**Siguiente bloque de trabajo:** Carpetas.')
append_once(
    'docs/ARCHITECTURE.md',
    '## Fichas de contacto privadas V1',
    '''## Fichas de contacto privadas V1

- Una ficha de contacto es un bloque `contact` dentro de `blocks-v1`; se cifra y guarda junto con la nota.
- V1 no escribe en la agenda del sistema ni sincroniza contactos con servicios externos.
- Los campos iniciales son nombre, teléfono, correo, organización y notas; todos permanecen opcionales para permitir fichas parciales.
- La tarjeta usa una sola implementación fluida por contenedor para móvil, tablet y PC.''',
)
append_once(
    'docs/CHANGELOG.md',
    'Fichas de contacto privadas V1',
    '''- Fichas de contacto privadas V1 como bloque cifrado nativo con nombre, teléfono, correo, organización y notas; inserción desde `＋`, edición directa y layout fluido por contenedor.''',
)
