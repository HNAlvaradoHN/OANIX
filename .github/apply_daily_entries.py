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
# Daily-entry model and validation.
# ---------------------------------------------------------------------------
replace_once(
    'src/features/notes/noteTypes.ts',
    """export interface ContactBlock {\n  id: string\n  type: 'contact'\n  name: string\n  phone: string\n  email: string\n  organization: string\n  notes: string\n}\n\nexport interface DividerBlock {\n""",
    """export interface ContactBlock {\n  id: string\n  type: 'contact'\n  name: string\n  phone: string\n  email: string\n  organization: string\n  notes: string\n}\n\nexport interface DailyEntryBlock {\n  id: string\n  type: 'dailyEntry'\n  date: string\n  title: string\n}\n\nexport interface DividerBlock {\n""",
)
replace_once(
    'src/features/notes/noteTypes.ts',
    """  | ChecklistBlock\n  | ContactBlock\n  | DividerBlock\n""",
    """  | ChecklistBlock\n  | ContactBlock\n  | DailyEntryBlock\n  | DividerBlock\n""",
)
replace_once(
    'src/features/notes/noteTypes.ts',
    """    organization?: unknown\n    notes?: unknown\n  }\n""",
    """    organization?: unknown\n    notes?: unknown\n    date?: unknown\n    title?: unknown\n  }\n""",
)
replace_once(
    'src/features/notes/noteTypes.ts',
    """  if (block.type === 'contact') {\n    return (\n      typeof block.name === 'string' &&\n      typeof block.phone === 'string' &&\n      typeof block.email === 'string' &&\n      typeof block.organization === 'string' &&\n      typeof block.notes === 'string'\n    )\n  }\n\n  if (block.type === 'paragraph' || block.type === 'quote') {\n""",
    """  if (block.type === 'contact') {\n    return (\n      typeof block.name === 'string' &&\n      typeof block.phone === 'string' &&\n      typeof block.email === 'string' &&\n      typeof block.organization === 'string' &&\n      typeof block.notes === 'string'\n    )\n  }\n\n  if (block.type === 'dailyEntry') {\n    return (\n      typeof block.date === 'string' &&\n      /^\\d{4}-\\d{2}-\\d{2}$/.test(block.date) &&\n      typeof block.title === 'string'\n    )\n  }\n\n  if (block.type === 'paragraph' || block.type === 'quote') {\n""",
)
replace_once(
    'src/features/notes/noteTypes.ts',
    """      if (block.type === 'contact') {\n        return [block.name, block.phone, block.email, block.organization, block.notes]\n          .map((value) => value.trim())\n          .filter(Boolean)\n      }\n      if (block.type === 'bulletList' || block.type === 'orderedList') {\n""",
    """      if (block.type === 'contact') {\n        return [block.name, block.phone, block.email, block.organization, block.notes]\n          .map((value) => value.trim())\n          .filter(Boolean)\n      }\n      if (block.type === 'dailyEntry') {\n        return block.title.trim() ? [block.title.trim()] : []\n      }\n      if (block.type === 'bulletList' || block.type === 'orderedList') {\n""",
)

# ---------------------------------------------------------------------------
# Daily-entry helpers: local date, old-note preparation and current-day entry.
# ---------------------------------------------------------------------------
Path('src/features/notes/dailyEntries.ts').write_text("""import type { DailyEntryBlock, NoteRecord, ParagraphBlock, StoredNoteBlock } from './noteTypes'\n\nfunction createBlockId(): string {\n  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()\n\n  if (!globalThis.crypto?.getRandomValues) {\n    throw new Error('Secure random generation is not available in this browser.')\n  }\n\n  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)))\n    .map((byte) => byte.toString(16).padStart(2, '0'))\n    .join('')\n}\n\nexport function localDateKey(date: Date = new Date()): string {\n  const year = date.getFullYear()\n  const month = String(date.getMonth() + 1).padStart(2, '0')\n  const day = String(date.getDate()).padStart(2, '0')\n  return `${year}-${month}-${day}`\n}\n\nexport function formatDailyEntryDate(dateKey: string): string {\n  const [year, month, day] = dateKey.split('-').map(Number)\n  const value = new Date(year, Math.max(0, month - 1), day, 12, 0, 0)\n  if (Number.isNaN(value.getTime())) return dateKey\n\n  const label = new Intl.DateTimeFormat('es-HN', {\n    weekday: 'long',\n    day: 'numeric',\n    month: 'long',\n    year: 'numeric',\n  }).format(value)\n\n  return label.charAt(0).toUpperCase() + label.slice(1)\n}\n\nexport function createDailyEntryBlocks(date: Date = new Date()): [DailyEntryBlock, ParagraphBlock] {\n  return [\n    { id: createBlockId(), type: 'dailyEntry', date: localDateKey(date), title: '' },\n    { id: createBlockId(), type: 'paragraph', runs: [] },\n  ]\n}\n\nfunction cloneBlocks(blocks: StoredNoteBlock[]): StoredNoteBlock[] {\n  return structuredClone(blocks)\n}\n\nexport function prepareDailyEntriesForEditing(\n  note: Pick<NoteRecord, 'createdAt' | 'content'>,\n  now: Date = new Date(),\n): StoredNoteBlock[] {\n  const blocks = cloneBlocks(note.content.blocks)\n  const firstEntryIndex = blocks.findIndex((block) => block.type === 'dailyEntry')\n\n  if (firstEntryIndex < 0) {\n    const created = new Date(note.createdAt)\n    const firstDate = Number.isNaN(created.getTime()) ? now : created\n    const [entry] = createDailyEntryBlocks(firstDate)\n    blocks.unshift(entry)\n  }\n\n  const today = localDateKey(now)\n  const lastEntry = [...blocks].reverse().find((block) => block.type === 'dailyEntry')\n\n  if (!lastEntry || lastEntry.type !== 'dailyEntry' || lastEntry.date !== today) {\n    const [entry, paragraph] = createDailyEntryBlocks(now)\n    blocks.push(entry, paragraph)\n  } else if (blocks.at(-1)?.type === 'dailyEntry') {\n    blocks.push({ id: createBlockId(), type: 'paragraph', runs: [] })\n  }\n\n  return blocks\n}\n""", encoding='utf-8')

# New notes begin inside today's dated entry.
replace_once(
    'src/features/notes/noteService.ts',
    """import { deleteNoteRecord, listNotes, readNote, saveNote } from '../../storage/repositories/noteRepository'\nimport type { NoteRecord, StoredNoteBlock } from './noteTypes'\n""",
    """import { deleteNoteRecord, listNotes, readNote, saveNote } from '../../storage/repositories/noteRepository'\nimport { createDailyEntryBlocks } from './dailyEntries'\nimport type { NoteRecord, StoredNoteBlock } from './noteTypes'\n""",
)
replace_once(
    'src/features/notes/noteService.ts',
    """export async function createEmptyNote(): Promise<NoteRecord> {\n  const now = new Date().toISOString()\n  const note: NoteRecord = {\n""",
    """export async function createEmptyNote(): Promise<NoteRecord> {\n  const nowDate = new Date()\n  const now = nowDate.toISOString()\n  const note: NoteRecord = {\n""",
)
replace_once(
    'src/features/notes/noteService.ts',
    """    content: {\n      format: 'blocks-v1',\n      blocks: [],\n    },\n""",
    """    content: {\n      format: 'blocks-v1',\n      blocks: createDailyEntryBlocks(nowDate),\n    },\n""",
)

# Workspace prepares legacy notes and automatically appends today's virtual entry.
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """import { createEmptyNote, deleteNote, loadNotes, renameNote, replaceNoteContent } from './noteService'\nimport { noteBlocksToPlainText, type NoteRecord, type StoredNoteBlock } from './noteTypes'\n""",
    """import { createEmptyNote, deleteNote, loadNotes, renameNote, replaceNoteContent } from './noteService'\nimport { prepareDailyEntriesForEditing } from './dailyEntries'\nimport { noteBlocksToPlainText, type NoteRecord, type StoredNoteBlock } from './noteTypes'\n""",
)
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """              <ImageNoteEditor\n                key={selectedNote.id}\n                noteId={selectedNote.id}\n                initialBlocks={selectedNote.content.blocks}\n""",
    """              <ImageNoteEditor\n                key={selectedNote.id}\n                noteId={selectedNote.id}\n                initialBlocks={prepareDailyEntriesForEditing(selectedNote)}\n""",
)

# Daily-entry rendering, parsing, editing and insertion in the rich editor.
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    """import {\n  CODE_LANGUAGES,\n  normalizeCodeLanguage,\n  normalizeNoteLink,\n  noteBlocksToPlainText,\n""",
    """import {\n  CODE_LANGUAGES,\n  normalizeCodeLanguage,\n  normalizeNoteLink,\n  noteBlocksToPlainText,\n""",
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    """} from '../notes/noteTypes'\nimport './editor.css'\n""",
    """} from '../notes/noteTypes'\nimport { createDailyEntryBlocks, formatDailyEntryDate, localDateKey } from '../notes/dailyEntries'\nimport './editor.css'\n""",
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    """function contactFieldValue(block: HTMLElement, name: string): string {\n  const field = block.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-contact-field=\\\"${name}\\\"]`)\n  return field?.value ?? ''\n}\n\nfunction blocksToHtml(blocks: NoteBlock[]): string {\n""",
    """function contactFieldValue(block: HTMLElement, name: string): string {\n  const field = block.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-contact-field=\\\"${name}\\\"]`)\n  return field?.value ?? ''\n}\n\nfunction dailyEntryBlockToHtml(block: Extract<NoteBlock, { type: 'dailyEntry' }>): string {\n  const id = escapeHtml(block.id)\n  const date = escapeHtml(block.date)\n  const title = escapeHtml(block.title)\n  const label = escapeHtml(formatDailyEntryDate(block.date))\n  return `<div class=\\\"editor-daily-entry\\\" data-daily-entry-block=\\\"true\\\" data-daily-entry-date=\\\"${date}\\\" data-block-id=\\\"${id}\\\" contenteditable=\\\"false\\\"><div class=\\\"editor-daily-entry__date-row\\\"><span class=\\\"editor-daily-entry__date\\\">${label}</span></div><input class=\\\"editor-daily-entry__title\\\" data-daily-entry-title=\\\"true\\\" type=\\\"text\\\" value=\\\"${title}\\\" maxlength=\\\"120\\\" placeholder=\\\"Título de esta entrada (opcional)\\\" autocomplete=\\\"off\\\"></div>`\n}\n\nfunction blocksToHtml(blocks: NoteBlock[]): string {\n""",
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    """      if (block.type === 'checklist') return checklistBlockToHtml(block)\n      if (block.type === 'contact') return contactBlockToHtml(block)\n      if (block.type === 'heading') {\n""",
    """      if (block.type === 'checklist') return checklistBlockToHtml(block)\n      if (block.type === 'contact') return contactBlockToHtml(block)\n      if (block.type === 'dailyEntry') return dailyEntryBlockToHtml(block)\n      if (block.type === 'heading') {\n""",
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    """    if (node.dataset.contactBlock === 'true') {\n      blocks.push({\n        id,\n        type: 'contact',\n        name: contactFieldValue(node, 'name'),\n        phone: contactFieldValue(node, 'phone'),\n        email: contactFieldValue(node, 'email'),\n        organization: contactFieldValue(node, 'organization'),\n        notes: contactFieldValue(node, 'notes'),\n      })\n      continue\n    }\n\n    if (node.dataset.checklistBlock === 'true') {\n""",
    """    if (node.dataset.contactBlock === 'true') {\n      blocks.push({\n        id,\n        type: 'contact',\n        name: contactFieldValue(node, 'name'),\n        phone: contactFieldValue(node, 'phone'),\n        email: contactFieldValue(node, 'email'),\n        organization: contactFieldValue(node, 'organization'),\n        notes: contactFieldValue(node, 'notes'),\n      })\n      continue\n    }\n\n    if (node.dataset.dailyEntryBlock === 'true') {\n      const title = node.querySelector<HTMLInputElement>('[data-daily-entry-title=\\\"true\\\"]')?.value ?? ''\n      blocks.push({\n        id,\n        type: 'dailyEntry',\n        date: node.dataset.dailyEntryDate ?? localDateKey(),\n        title,\n      })\n      continue\n    }\n\n    if (node.dataset.checklistBlock === 'true') {\n""",
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    """function isProtectedEditorBlock(element: HTMLElement): boolean {\n  return element.dataset.codeBlock === 'true' || element.dataset.imageBlock === 'true'\n}\n""",
    """function isProtectedEditorBlock(element: HTMLElement): boolean {\n  return (\n    element.dataset.codeBlock === 'true' ||\n    element.dataset.imageBlock === 'true' ||\n    element.dataset.dailyEntryBlock === 'true'\n  )\n}\n""",
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    """function isEditingContact(editor: HTMLElement): boolean {\n  const active = document.activeElement\n  return active instanceof Element && editor.contains(active) && !!active.closest('[data-contact-block=\\\"true\\\"]')\n}\n\nfunction atomicHostForInsertion(editor: HTMLElement, selection: Selection | null): HTMLElement | null {\n""",
    """function isEditingAtomicForm(editor: HTMLElement): boolean {\n  const active = document.activeElement\n  return (\n    active instanceof Element &&\n    editor.contains(active) &&\n    !!active.closest('[data-contact-block=\\\"true\\\"], [data-daily-entry-block=\\\"true\\\"]')\n  )\n}\n\nfunction atomicHostForInsertion(editor: HTMLElement, selection: Selection | null): HTMLElement | null {\n""",
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    """      '[data-code-block=\\\"true\\\"], [data-checklist-block=\\\"true\\\"], [data-contact-block=\\\"true\\\"]',\n""",
    """      '[data-code-block=\\\"true\\\"], [data-checklist-block=\\\"true\\\"], [data-contact-block=\\\"true\\\"], [data-daily-entry-block=\\\"true\\\"]',\n""",
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    """    '[data-code-block=\\\"true\\\"], [data-checklist-block=\\\"true\\\"], [data-contact-block=\\\"true\\\"]',\n""",
    """    '[data-code-block=\\\"true\\\"], [data-checklist-block=\\\"true\\\"], [data-contact-block=\\\"true\\\"], [data-daily-entry-block=\\\"true\\\"]',\n""",
)
# Replace all remaining direct contact-edit checks with the generic atomic-form check.
p = Path('src/features/editor/RichTextEditor.tsx')
text = p.read_text(encoding='utf-8').replace('isEditingContact(editor)', 'isEditingAtomicForm(editor)')
p.write_text(text, encoding='utf-8')

replace_once(
    'src/features/editor/RichTextEditor.tsx',
    """  function insertChecklistBlock() {\n""",
    """  function insertDailyEntryBlock() {\n    const editor = editorRef.current\n    if (!editor) return\n\n    const today = localDateKey()\n    const existing = Array.from(editor.querySelectorAll<HTMLElement>('[data-daily-entry-block=\\\"true\\\"]'))\n      .find((entry) => entry.dataset.dailyEntryDate === today)\n\n    if (existing) {\n      const title = existing.querySelector<HTMLInputElement>('[data-daily-entry-title=\\\"true\\\"]')\n      if (title && !title.value.trim()) {\n        title.focus()\n        return\n      }\n\n      let paragraph = editor.lastElementChild instanceof HTMLParagraphElement\n        ? editor.lastElementChild\n        : null\n      if (!paragraph) {\n        paragraph = createCaretParagraph()\n        editor.append(paragraph)\n        emitChange()\n      }\n      editor.focus()\n      placeCaretAtEnd(paragraph)\n      return\n    }\n\n    const [entry, paragraphBlock] = createDailyEntryBlocks()\n    editor.insertAdjacentHTML('beforeend', `${dailyEntryBlockToHtml(entry)}<p data-block-id=\\\"${escapeHtml(paragraphBlock.id)}\\\"><br></p>`)\n    emitChange()\n\n    const title = editor.querySelector<HTMLInputElement>(\n      `[data-block-id=\\\"${entry.id}\\\"] [data-daily-entry-title=\\\"true\\\"]`,\n    )\n    title?.focus()\n  }\n\n  function insertChecklistBlock() {\n""",
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    """  function handleEditorInput(event: ReactFormEvent<HTMLDivElement>) {\n    const target = event.target\n    if (target instanceof HTMLInputElement && target.dataset.contactField) {\n""",
    """  function handleEditorInput(event: ReactFormEvent<HTMLDivElement>) {\n    const target = event.target\n    if (target instanceof HTMLInputElement && target.dataset.dailyEntryTitle === 'true') {\n      target.setAttribute('value', target.value)\n    } else if (target instanceof HTMLInputElement && target.dataset.contactField) {\n""",
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    """  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {\n    const target = event.target\n    if (target instanceof Element && target.closest('[data-contact-field]')) return\n""",
    """  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {\n    const target = event.target\n    if (target instanceof Element && target.closest('[data-contact-field], [data-daily-entry-title=\\\"true\\\"]')) return\n""",
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    """  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {\n    const target = event.target\n    if (!(target instanceof Element)) return\n\n    const contactField = target.closest<HTMLInputElement | HTMLTextAreaElement>('[data-contact-field]')\n""",
    """  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {\n    const target = event.target\n    if (!(target instanceof Element)) return\n\n    const dailyTitle = target.closest<HTMLInputElement>('[data-daily-entry-title=\\\"true\\\"]')\n    if (dailyTitle) {\n      if (event.key === 'Enter') {\n        event.preventDefault()\n        const entry = dailyTitle.closest<HTMLElement>('[data-daily-entry-block=\\\"true\\\"]')\n        if (!entry) return\n        let paragraph = entry.nextElementSibling instanceof HTMLParagraphElement\n          ? entry.nextElementSibling\n          : null\n        if (!paragraph) {\n          paragraph = createCaretParagraph()\n          entry.after(paragraph)\n          emitChange()\n        }\n        editor.focus()\n        placeCaretAtStart(paragraph)\n      }\n      return\n    }\n\n    const contactField = target.closest<HTMLInputElement | HTMLTextAreaElement>('[data-contact-field]')\n""",
)
replace_once(
    'src/features/editor/RichTextEditor.tsx',
    """        <button className=\"editor-tool\" data-insert=\"checklist\" type=\"button\" onMouseDown={keepSelection} onClick={insertChecklistBlock} title=\"Checklist\">\n          ☑ Checklist\n        </button>\n        <button className=\"editor-tool\" data-insert=\"contact\" type=\"button\" onMouseDown={keepSelection} onClick={insertContactBlock} title=\"Contacto privado\">\n""",
    """        <button className=\"editor-tool\" data-insert=\"dailyEntry\" type=\"button\" onMouseDown={keepSelection} onClick={insertDailyEntryBlock} title=\"Nueva entrada de hoy\">\n          ◷ Entrada\n        </button>\n        <button className=\"editor-tool\" data-insert=\"checklist\" type=\"button\" onMouseDown={keepSelection} onClick={insertChecklistBlock} title=\"Checklist\">\n          ☑ Checklist\n        </button>\n        <button className=\"editor-tool\" data-insert=\"contact\" type=\"button\" onMouseDown={keepSelection} onClick={insertContactBlock} title=\"Contacto privado\">\n""",
)

# The outer insert menu exposes the new daily-entry action.
replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    """            <button type=\"button\" onPointerDown={keepEditorSelection} onClick={triggerImageInsert}><strong>▧</strong><span>Imagen</span></button>\n            <button type=\"button\" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format=\"code\"]')}><strong>&lt;/&gt;</strong><span>Código</span></button>\n""",
    """            <button type=\"button\" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-insert=\"dailyEntry\"]')}><strong>◷</strong><span>Nueva entrada</span></button>\n            <button type=\"button\" onPointerDown={keepEditorSelection} onClick={triggerImageInsert}><strong>▧</strong><span>Imagen</span></button>\n            <button type=\"button\" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format=\"code\"]')}><strong>&lt;/&gt;</strong><span>Código</span></button>\n""",
)

# Daily markers must survive global text deletion, while their title remains editable.
replace_once(
    'src/features/editor/protectedBlocks.ts',
    """function isProtectedBlock(block: StoredNoteBlock): boolean {\n  return block.type === 'image' || block.type === 'code'\n}\n""",
    """function isProtectedBlock(block: StoredNoteBlock): boolean {\n  return block.type === 'image' || block.type === 'code' || block.type === 'dailyEntry'\n}\n""",
)

# Fluid, chat-like date separator and optional per-entry title.
append_once(
    'src/features/editor/editor.css',
    '/* OANIX V1 daily entries */',
    """/* OANIX V1 daily entries */\n.editor-daily-entry {\n  width: 100%;\n  min-width: 0;\n  max-width: 100%;\n  display: grid;\n  justify-items: center;\n  gap: clamp(.4rem, 1.5cqw, .65rem);\n  margin: clamp(1.15rem, 3cqw, 1.8rem) 0 clamp(.65rem, 1.8cqw, 1rem);\n  box-sizing: border-box;\n  -webkit-user-select: none;\n  user-select: none;\n}\n.editor-daily-entry__date-row {\n  width: 100%;\n  min-width: 0;\n  display: grid;\n  grid-template-columns: minmax(1rem, 1fr) auto minmax(1rem, 1fr);\n  align-items: center;\n  gap: clamp(.5rem, 2cqw, .85rem);\n}\n.editor-daily-entry__date-row::before,\n.editor-daily-entry__date-row::after {\n  content: '';\n  min-width: 0;\n  border-top: 1px solid #dbe3ec;\n}\n.editor-daily-entry__date {\n  max-width: min(100%, 32rem);\n  padding: .38rem .8rem;\n  border: 1px solid #d8e0ea;\n  border-radius: 999px;\n  background: #f1f5f9;\n  color: #64748b;\n  font-size: clamp(.72rem, 2.2cqw, .82rem);\n  font-weight: 800;\n  line-height: 1.2;\n  text-align: center;\n  overflow-wrap: anywhere;\n}\n.editor-daily-entry__title {\n  width: min(100%, 32rem);\n  min-width: 0;\n  height: auto;\n  min-height: 2.45rem;\n  padding: .5rem .75rem;\n  border: 1px solid transparent;\n  border-radius: .75rem;\n  outline: none;\n  background: transparent;\n  color: #172033;\n  -webkit-text-fill-color: currentColor;\n  font: inherit;\n  font-size: clamp(.9rem, 2.6cqw, 1rem);\n  font-weight: 800;\n  text-align: center;\n  -webkit-user-select: text;\n  user-select: text;\n}\n.editor-daily-entry__title::placeholder { color: #9aa5b1; font-weight: 650; }\n.editor-daily-entry__title:hover,\n.editor-daily-entry__title:focus {\n  border-color: #cbd5e1;\n  background: #fff;\n  box-shadow: 0 0 0 3px rgba(37,99,235,.08);\n}\n@container (max-width: 28rem) {\n  .editor-daily-entry__date-row { grid-template-columns: minmax(.5rem, 1fr) auto minmax(.5rem, 1fr); gap: .4rem; }\n  .editor-daily-entry__date { padding-inline: .6rem; }\n  .editor-daily-entry__title { width: 100%; }\n}\n""",
)

# Tests for midnight/day behavior and backwards compatibility.
Path('tests/dailyEntries.test.ts').write_text("""import assert from 'node:assert/strict'\nimport test from 'node:test'\n\nimport {\n  createDailyEntryBlocks,\n  localDateKey,\n  prepareDailyEntriesForEditing,\n} from '../src/features/notes/dailyEntries.ts'\nimport { isNoteRecord, type NoteRecord } from '../src/features/notes/noteTypes.ts'\n\nfunction noteWith(blocks: NoteRecord['content']['blocks'], createdAt: string): NoteRecord {\n  return {\n    version: 1,\n    id: 'note-daily-entry-test',\n    title: 'Bitácora',\n    createdAt,\n    updatedAt: createdAt,\n    content: { format: 'blocks-v1', blocks },\n  }\n}\n\ntest('localDateKey changes at the local calendar day boundary', () => {\n  assert.equal(localDateKey(new Date(2026, 7, 15, 23, 59, 59)), '2026-08-15')\n  assert.equal(localDateKey(new Date(2026, 7, 16, 0, 0, 1)), '2026-08-16')\n})\n\ntest('new daily entry blocks are valid stored note blocks', () => {\n  const [entry, paragraph] = createDailyEntryBlocks(new Date(2026, 7, 15, 12, 0, 0))\n  assert.equal(entry.type, 'dailyEntry')\n  assert.equal(entry.date, '2026-08-15')\n  assert.equal(isNoteRecord(noteWith([entry, paragraph], new Date(2026, 7, 15).toISOString())), true)\n})\n\ntest('legacy notes get their original day marker and todays continuation', () => {\n  const created = new Date(2026, 7, 14, 10, 0, 0)\n  const note = noteWith([{ id: 'paragraph-old', type: 'paragraph', runs: [{ text: 'Ayer' }] }], created.toISOString())\n  const blocks = prepareDailyEntriesForEditing(note, new Date(2026, 7, 15, 9, 0, 0))\n  const entries = blocks.filter((block) => block.type === 'dailyEntry')\n\n  assert.equal(entries.length, 2)\n  assert.equal(entries[0].type === 'dailyEntry' ? entries[0].date : '', '2026-08-14')\n  assert.equal(entries[1].type === 'dailyEntry' ? entries[1].date : '', '2026-08-15')\n  assert.equal(blocks.some((block) => block.type === 'paragraph' && block.runs.some((run) => run.text === 'Ayer')), true)\n})\n\ntest('opening the same note again on the same day does not duplicate the marker', () => {\n  const [entry, paragraph] = createDailyEntryBlocks(new Date(2026, 7, 15, 8, 0, 0))\n  const note = noteWith([entry, paragraph], new Date(2026, 7, 15, 8, 0, 0).toISOString())\n  const blocks = prepareDailyEntriesForEditing(note, new Date(2026, 7, 15, 20, 0, 0))\n  assert.equal(blocks.filter((block) => block.type === 'dailyEntry').length, 1)\n})\n\ntest('daily-entry validation rejects malformed dates', () => {\n  const note = noteWith([{ id: 'entry-invalid', type: 'dailyEntry', date: '15/08/2026', title: '' } as never], new Date().toISOString())\n  assert.equal(isNoteRecord(note), false)\n})\n""", encoding='utf-8')

# Roadmap and changelog: daily entries are a completed V1 refinement before folders.
replace_once(
    'docs/ROADMAP.md',
    """- [x] Fichas de contacto privadas\n- [ ] Carpetas\n""",
    """- [x] Fichas de contacto privadas\n- [x] Entradas por día dentro de una nota (fecha automática + título opcional)\n- [ ] Carpetas\n""",
)
append_once(
    'docs/CHANGELOG.md',
    'Entradas por día dentro de una misma nota',
    """- Entradas por día dentro de una misma nota: separador visual con fecha local automática, título opcional por entrada, preparación compatible con notas antiguas y nueva sección cuando cambia el día.\n""",
)
