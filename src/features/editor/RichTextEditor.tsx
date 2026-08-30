import {
  useCallback,
  useEffect,
  useRef,
  type ClipboardEvent,
  type FormEvent as ReactFormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  CODE_LANGUAGES,
  normalizeCodeLanguage,
  normalizeNoteLink,
  noteBlocksToPlainText,
  type CodeLanguage,
  type NoteBlock,
  type RichTextRun,
} from '../notes/noteTypes'
import { createDailyEntryBlocks, formatDailyEntryDate, localDateKey } from '../notes/dailyEntries'
import './editor.css'

interface RichTextEditorProps {
  noteId: string
  initialBlocks: NoteBlock[]
  onChange: (blocks: NoteBlock[]) => void
  onBlur: () => void
}

interface RunStyle {
  bold?: boolean
  italic?: boolean
  href?: string
}

type ToolbarFormat =
  | 'bold'
  | 'italic'
  | 'paragraph'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'orderedList'
  | 'quote'
  | 'link'
  | 'code'

const CODE_LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  plaintext: 'Texto',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  html: 'HTML',
  css: 'CSS',
  json: 'JSON',
  bash: 'Bash',
  sql: 'SQL',
  java: 'Java',
  cpp: 'C / C++',
  csharp: 'C#',
  kotlin: 'Kotlin',
  swift: 'Swift',
  php: 'PHP',
}

function createBlockId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()

  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random generation is not available in this browser.')
  }

  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function runToHtml(run: RichTextRun): string {
  let html = escapeHtml(run.text).replaceAll('\n', '<br>')

  if (run.bold) html = `<strong>${html}</strong>`
  if (run.italic) html = `<em>${html}</em>`
  if (run.href) html = `<a href="${escapeHtml(run.href)}" rel="noopener noreferrer">${html}</a>`

  return html
}

function runsToHtml(runs: RichTextRun[]): string {
  const html = runs.map(runToHtml).join('')
  return html || '<br>'
}

function codeLanguageOptions(selected: CodeLanguage): string {
  return CODE_LANGUAGES.map((language) => {
    const selectedAttribute = language === selected ? ' selected' : ''
    return `<option value="${language}"${selectedAttribute}>${escapeHtml(CODE_LANGUAGE_LABELS[language])}</option>`
  }).join('')
}

function codeBlockToHtml(block: Extract<NoteBlock, { type: 'code' }>): string {
  const id = escapeHtml(block.id)
  const language = normalizeCodeLanguage(block.language)
  const text = escapeHtml(block.text)

  return `<div class="editor-code-block" data-code-block="true" data-block-id="${id}" data-language="${language}" contenteditable="false"><div class="editor-code-block__toolbar"><select class="editor-code-block__language" data-code-language="true" aria-label="Lenguaje del bloque de código">${codeLanguageOptions(language)}</select><button class="editor-code-block__copy" data-code-copy="true" type="button">Copiar</button></div><div class="editor-code-block__content" data-code-content="true" contenteditable="true" spellcheck="false" autocapitalize="off" tabindex="0">${text}</div></div>`
}

type ChecklistItemModel = Extract<NoteBlock, { type: 'checklist' }>['items'][number]

function checklistItemToHtml(item: ChecklistItemModel): string {
  const checked = item.checked ? 'true' : 'false'
  const mark = item.checked ? '✓' : ''
  const label = item.checked ? 'Marcar tarea como pendiente' : 'Marcar tarea como completada'
  const text = escapeHtml(item.text).replaceAll('\n', '<br>') || '<br>'
  return `<div class="editor-checklist__item" data-checklist-item="true" data-checked="${checked}"><button class="editor-checklist__toggle" data-checklist-toggle="true" type="button" aria-pressed="${checked}" aria-label="${label}">${mark}</button><div class="editor-checklist__text" data-checklist-text="true" contenteditable="true" role="textbox" aria-label="Tarea de checklist" spellcheck="true">${text}</div></div>`
}

function checklistBlockToHtml(block: Extract<NoteBlock, { type: 'checklist' }>): string {
  const id = escapeHtml(block.id)
  const items = block.items.length > 0 ? block.items : [{ text: '', checked: false }]
  return `<div class="editor-checklist" data-checklist-block="true" data-block-id="${id}" contenteditable="false">${items.map(checklistItemToHtml).join('')}</div>`
}

function createChecklistItemElement(item: ChecklistItemModel): HTMLElement {
  const template = document.createElement('template')
  template.innerHTML = checklistItemToHtml(item)
  const element = template.content.firstElementChild
  if (!(element instanceof HTMLElement)) throw new Error('Checklist item could not be created.')
  return element
}

function contactInitial(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase() || 'C'
}

function contactBlockToHtml(block: Extract<NoteBlock, { type: 'contact' }>): string {
  const id = escapeHtml(block.id)
  const initial = escapeHtml(contactInitial(block.name))
  return `<div class="editor-contact-card" data-contact-block="true" data-block-id="${id}" contenteditable="false"><div class="editor-contact-card__header"><div class="editor-contact-card__avatar" data-contact-avatar="true" aria-hidden="true">${initial}</div><div class="editor-contact-card__title"><strong>Contacto privado</strong><span>Cifrado dentro de esta nota</span></div><button class="editor-contact-card__remove" data-contact-remove="true" type="button">Eliminar</button></div><div class="editor-contact-card__fields"><label class="editor-contact-card__field"><span>Nombre</span><input data-contact-field="name" type="text" value="${escapeHtml(block.name)}" autocomplete="off"></label><label class="editor-contact-card__field"><span>Teléfono</span><input data-contact-field="phone" type="tel" value="${escapeHtml(block.phone)}" autocomplete="off" inputmode="tel"></label><label class="editor-contact-card__field"><span>Correo</span><input data-contact-field="email" type="email" value="${escapeHtml(block.email)}" autocomplete="off" autocapitalize="none" spellcheck="false"></label><label class="editor-contact-card__field"><span>Organización</span><input data-contact-field="organization" type="text" value="${escapeHtml(block.organization)}" autocomplete="off"></label><label class="editor-contact-card__field editor-contact-card__field--notes"><span>Notas</span><textarea data-contact-field="notes" rows="3" autocomplete="off">${escapeHtml(block.notes)}</textarea></label></div></div>`
}

function contactFieldValue(block: HTMLElement, name: string): string {
  const field = block.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-contact-field="${name}"]`)
  return field?.value ?? ''
}

function dailyEntryBlockToHtml(block: Extract<NoteBlock, { type: 'dailyEntry' }>): string {
  const id = escapeHtml(block.id)
  const date = escapeHtml(block.date)
  const title = escapeHtml(block.title)
  const label = escapeHtml(formatDailyEntryDate(block.date))
  return `<div class="editor-daily-entry" data-daily-entry-block="true" data-editor-selection-island="true" data-daily-entry-date="${date}" data-block-id="${id}" contenteditable="false"><div class="editor-daily-entry__date-row"><span class="editor-daily-entry__date">${label}</span></div><input class="editor-daily-entry__title" data-daily-entry-title="true" type="text" value="${title}" maxlength="120" placeholder="Título de esta entrada (opcional)" autocomplete="off"></div>`
}

function blocksToHtml(blocks: NoteBlock[]): string {
  if (blocks.length === 0) {
    return `<p data-block-id="${createBlockId()}"><br></p>`
  }

  return blocks
    .map((block) => {
      const id = escapeHtml(block.id)

      if (block.type === 'divider') return `<hr data-block-id="${id}">`
      if (block.type === 'code') return codeBlockToHtml(block)
      if (block.type === 'checklist') return checklistBlockToHtml(block)
      if (block.type === 'contact') return contactBlockToHtml(block)
      if (block.type === 'dailyEntry') return dailyEntryBlockToHtml(block)
      if (block.type === 'heading') {
        return `<h${block.level} data-block-id="${id}">${runsToHtml(block.runs)}</h${block.level}>`
      }
      if (block.type === 'quote') {
        return `<blockquote data-block-id="${id}">${runsToHtml(block.runs)}</blockquote>`
      }
      if (block.type === 'bulletList' || block.type === 'orderedList') {
        const tag = block.type === 'bulletList' ? 'ul' : 'ol'
        const items = block.items.map((item) => `<li>${runsToHtml(item)}</li>`).join('')
        return `<${tag} data-block-id="${id}">${items || '<li><br></li>'}</${tag}>`
      }

      return `<p data-block-id="${id}">${runsToHtml(block.runs)}</p>`
    })
    .join('')
}

function blockIdFromElement(element: HTMLElement): string {
  const current = element.dataset.blockId
  if (current && /^[A-Za-z0-9-]{8,}$/.test(current)) return current

  const id = createBlockId()
  element.dataset.blockId = id
  return id
}

function sameRunStyle(left: RichTextRun, right: RichTextRun): boolean {
  return left.bold === right.bold && left.italic === right.italic && left.href === right.href
}

function mergeRuns(runs: RichTextRun[]): RichTextRun[] {
  const merged: RichTextRun[] = []

  for (const run of runs) {
    if (run.text.length === 0) continue

    const previous = merged.at(-1)
    if (previous && sameRunStyle(previous, run)) {
      previous.text += run.text
    } else {
      merged.push({ ...run })
    }
  }

  if (merged.length === 1 && merged[0].text === '\n') return []
  return merged
}

function parseRuns(node: Node, inherited: RunStyle = {}): RichTextRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.nodeValue ?? '').replaceAll('\u00a0', ' ')
    return text ? [{ text, ...inherited }] : []
  }

  if (!(node instanceof HTMLElement)) return []

  const tag = node.tagName.toLowerCase()
  if (tag === 'br') return [{ text: '\n', ...inherited }]

  const style: RunStyle = { ...inherited }
  if (tag === 'strong' || tag === 'b') style.bold = true
  if (tag === 'em' || tag === 'i') style.italic = true

  if (tag === 'a') {
    const safeHref = normalizeNoteLink(node.getAttribute('href') ?? '')
    if (safeHref) style.href = safeHref
  }

  return Array.from(node.childNodes).flatMap((child) => parseRuns(child, style))
}

function parseBlockRuns(element: HTMLElement): RichTextRun[] {
  return mergeRuns(Array.from(element.childNodes).flatMap((child) => parseRuns(child)))
}

function codeTextFromElement(element: HTMLElement | null): string {
  if (!element) return ''
  return element.innerText.replace(/\r\n?/g, '\n').replaceAll('\u00a0', ' ')
}

function parseEditorBlocks(root: HTMLElement): NoteBlock[] {
  const blocks: NoteBlock[] = []

  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.nodeValue ?? '').trim()
      if (text) {
        blocks.push({ id: createBlockId(), type: 'paragraph', runs: [{ text }] })
      }
      continue
    }

    if (!(node instanceof HTMLElement)) continue

    const tag = node.tagName.toLowerCase()
    const id = blockIdFromElement(node)

    if (node.dataset.codeBlock === 'true') {
      blocks.push({
        id,
        type: 'code',
        language: normalizeCodeLanguage(node.dataset.language),
        text: codeTextFromElement(node.querySelector<HTMLElement>('[data-code-content="true"]')),
      })
      continue
    }

    if (node.dataset.contactBlock === 'true') {
      blocks.push({
        id,
        type: 'contact',
        name: contactFieldValue(node, 'name'),
        phone: contactFieldValue(node, 'phone'),
        email: contactFieldValue(node, 'email'),
        organization: contactFieldValue(node, 'organization'),
        notes: contactFieldValue(node, 'notes'),
      })
      continue
    }

    if (node.dataset.dailyEntryBlock === 'true') {
      const title = node.querySelector<HTMLInputElement>('[data-daily-entry-title="true"]')?.value ?? ''
      blocks.push({
        id,
        type: 'dailyEntry',
        date: node.dataset.dailyEntryDate ?? localDateKey(),
        title,
      })
      continue
    }

    if (node.dataset.checklistBlock === 'true') {
      const items = Array.from(node.children)
        .filter((child): child is HTMLElement =>
          child instanceof HTMLElement && child.dataset.checklistItem === 'true',
        )
        .map((item) => {
          const textElement = item.querySelector<HTMLElement>('[data-checklist-text="true"]')
          const rawText = codeTextFromElement(textElement)
          return {
            text: /^\n*$/.test(rawText) ? '' : rawText,
            checked: item.dataset.checked === 'true',
          }
        })

      blocks.push({
        id,
        type: 'checklist',
        items: items.length > 0 ? items : [{ text: '', checked: false }],
      })
      continue
    }

    if (tag === 'hr') {
      blocks.push({ id, type: 'divider' })
      continue
    }

    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      blocks.push({
        id,
        type: 'heading',
        level: Number(tag.slice(1)) as 1 | 2 | 3,
        runs: parseBlockRuns(node),
      })
      continue
    }

    if (tag === 'blockquote') {
      blocks.push({ id, type: 'quote', runs: parseBlockRuns(node) })
      continue
    }

    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(node.children)
        .filter(
          (child): child is HTMLElement =>
            child instanceof HTMLElement && child.tagName.toLowerCase() === 'li',
        )
        .map(parseBlockRuns)

      blocks.push({
        id,
        type: tag === 'ul' ? 'bulletList' : 'orderedList',
        items: items.length > 0 ? items : [[]],
      })
      continue
    }

    blocks.push({ id, type: 'paragraph', runs: parseBlockRuns(node) })
  }

  return blocks
}

function isEditorEmpty(blocks: NoteBlock[]): boolean {
  return blocks.every((block) => block.type !== 'divider') && noteBlocksToPlainText(blocks).length === 0
}

function setEditorEmptyState(editor: HTMLElement, blocks: NoteBlock[]): void {
  editor.dataset.empty = isEditorEmpty(blocks) ? 'true' : 'false'
}

function placeCaretAtEnd(editor: HTMLElement): void {
  const selection = window.getSelection()
  if (!selection) return

  const range = document.createRange()
  range.selectNodeContents(editor)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

function placeCaretAtStart(element: HTMLElement): void {
  const selection = window.getSelection()
  if (!selection) return

  const range = document.createRange()
  range.selectNodeContents(element)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

function createCaretParagraph(): HTMLParagraphElement {
  const paragraph = document.createElement('p')
  paragraph.dataset.blockId = createBlockId()
  paragraph.append(document.createElement('br'))
  return paragraph
}

function isEmptyCaretParagraph(element: Element | null): element is HTMLParagraphElement {
  return (
    element instanceof HTMLParagraphElement &&
    (element.textContent ?? '').trim() === '' &&
    !element.querySelector('[data-code-block="true"], [data-image-block="true"]')
  )
}

function isProtectedEditorBlock(element: HTMLElement): boolean {
  return (
    element.dataset.codeBlock === 'true' ||
    element.dataset.imageBlock === 'true' ||
    element.dataset.dailyEntryBlock === 'true'
  )
}

function directEditorBlocks(editor: HTMLElement): HTMLElement[] {
  return Array.from(editor.children).filter((child): child is HTMLElement => child instanceof HTMLElement)
}

function placeCaretFromEditorBackground(editor: HTMLElement, clientY: number): boolean {
  const blocks = directEditorBlocks(editor)

  if (blocks.length === 0) {
    const paragraph = createCaretParagraph()
    editor.append(paragraph)
    editor.focus()
    placeCaretAtStart(paragraph)
    return true
  }

  const protectedAtY = blocks.find((block) => {
    if (!isProtectedEditorBlock(block)) return false
    const rect = block.getBoundingClientRect()
    return clientY >= rect.top && clientY <= rect.bottom
  })

  if (protectedAtY) {
    const next = protectedAtY.nextElementSibling
    if (isEmptyCaretParagraph(next)) {
      editor.focus()
      placeCaretAtStart(next)
      return false
    }

    const paragraph = createCaretParagraph()
    protectedAtY.after(paragraph)
    editor.focus()
    placeCaretAtStart(paragraph)
    return true
  }

  const nextIndex = blocks.findIndex((block) => clientY < block.getBoundingClientRect().top)

  if (nextIndex === 0) {
    const first = blocks[0]
    if (isEmptyCaretParagraph(first)) {
      editor.focus()
      placeCaretAtStart(first)
      return false
    }

    const paragraph = createCaretParagraph()
    first.before(paragraph)
    editor.focus()
    placeCaretAtStart(paragraph)
    return true
  }

  if (nextIndex > 0) {
    const previous = blocks[nextIndex - 1]
    const next = blocks[nextIndex]

    if (isEmptyCaretParagraph(previous)) {
      editor.focus()
      placeCaretAtEnd(previous)
      return false
    }

    if (isEmptyCaretParagraph(next)) {
      editor.focus()
      placeCaretAtStart(next)
      return false
    }

    const paragraph = createCaretParagraph()
    next.before(paragraph)
    editor.focus()
    placeCaretAtStart(paragraph)
    return true
  }

  const last = blocks.at(-1)
  if (last && isEmptyCaretParagraph(last)) {
    editor.focus()
    placeCaretAtStart(last)
    return false
  }

  const paragraph = createCaretParagraph()
  editor.append(paragraph)
  editor.focus()
  placeCaretAtStart(paragraph)
  return true
}

function selectionIsInsideEditor(editor: HTMLElement, selection: Selection | null): selection is Selection {
  if (!selection || selection.rangeCount === 0) return false
  return editor.contains(selection.getRangeAt(0).commonAncestorContainer)
}

function elementFromSelectionNode(node: Node | null): Element | null {
  if (node instanceof Element) return node
  return node?.parentElement ?? null
}

function selectionIsInsideCodeBlock(editor: HTMLElement, selection: Selection | null): boolean {
  if (!selectionIsInsideEditor(editor, selection)) return false
  const element = elementFromSelectionNode(selection.anchorNode)
  return !!element?.closest('[data-code-content="true"]')
}

function selectionIsInsideChecklist(editor: HTMLElement, selection: Selection | null): boolean {
  if (!selectionIsInsideEditor(editor, selection)) return false
  const element = elementFromSelectionNode(selection.anchorNode)
  return !!element?.closest('[data-checklist-text="true"]')
}

function isEditingAtomicForm(editor: HTMLElement): boolean {
  const active = document.activeElement
  return (
    active instanceof Element &&
    editor.contains(active) &&
    !!active.closest('[data-contact-block="true"], [data-daily-entry-block="true"]')
  )
}

function atomicHostForInsertion(editor: HTMLElement, selection: Selection | null): HTMLElement | null {
  const active = document.activeElement
  if (active instanceof Element && editor.contains(active)) {
    const activeHost = active.closest<HTMLElement>(
      '[data-code-block="true"], [data-checklist-block="true"], [data-contact-block="true"], [data-daily-entry-block="true"]',
    )
    if (activeHost?.parentElement === editor) return activeHost
  }

  const anchorElement = elementFromSelectionNode(selection?.anchorNode ?? null)
  const selectionHost = anchorElement?.closest<HTMLElement>(
    '[data-code-block="true"], [data-checklist-block="true"], [data-contact-block="true"], [data-daily-entry-block="true"]',
  )
  return selectionHost?.parentElement === editor ? selectionHost : null
}

function selectionHasLink(editor: HTMLElement, selection: Selection): boolean {
  let current: HTMLElement | null =
    selection.anchorNode instanceof HTMLElement
      ? selection.anchorNode
      : selection.anchorNode?.parentElement ?? null

  while (current && current !== editor) {
    if (current.tagName.toLowerCase() === 'a') return true
    current = current.parentElement
  }

  return false
}

function normalizeFormatBlock(value: string): string {
  return value.trim().toLowerCase().replace(/[<>]/g, '')
}

function setToolbarButtonState(toolbar: HTMLElement, format: ToolbarFormat, active: boolean): void {
  const button = toolbar.querySelector<HTMLButtonElement>(`[data-format="${format}"]`)
  if (!button) return

  button.classList.toggle('editor-tool--active', active)
  button.setAttribute('aria-pressed', active ? 'true' : 'false')
}

function linkFromTarget(editor: HTMLElement, target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null

  const link = target.closest('a')
  return link instanceof HTMLAnchorElement && editor.contains(link) ? link : null
}

function codeBlockFromTarget(editor: HTMLElement, target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const block = target.closest<HTMLElement>('[data-code-block="true"]')
  return block && editor.contains(block) ? block : null
}

function openSafeLink(rawHref: string): void {
  const href = normalizeNoteLink(rawHref)
  if (!href) return

  if (href.startsWith('http://') || href.startsWith('https://')) {
    window.open(href, '_blank', 'noopener,noreferrer')
    return
  }

  window.location.href = href
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}

function RichTextEditorComponent({
  noteId,
  initialBlocks,
  onChange,
  onBlur,
}: RichTextEditorProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const linkPopoverRef = useRef<HTMLDivElement>(null)
  const linkHrefRef = useRef<HTMLSpanElement>(null)
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null)
  const initialHtmlRef = useRef(blocksToHtml(initialBlocks))
  const lastHtmlRef = useRef(initialHtmlRef.current)
  const restoringRef = useRef(false)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const pointerDraggedRef = useRef(false)

  const attachEditor = useCallback(
    (editor: HTMLDivElement | null) => {
      editorRef.current = editor
      if (!editor) return

      editor.innerHTML = initialHtmlRef.current
      lastHtmlRef.current = editor.innerHTML
      setEditorEmptyState(editor, parseEditorBlocks(editor))
    },
    [noteId],
  )

  const hideLinkPopover = useCallback(() => {
    activeLinkRef.current = null

    const popover = linkPopoverRef.current
    if (!popover) return

    popover.hidden = true
    popover.style.left = ''
    popover.style.top = ''
  }, [])

  const showLinkPopover = useCallback((link: HTMLAnchorElement) => {
    const frame = frameRef.current
    const popover = linkPopoverRef.current
    const hrefLabel = linkHrefRef.current
    const href = normalizeNoteLink(link.getAttribute('href') ?? '')
    if (!frame || !popover || !hrefLabel || !href) return

    activeLinkRef.current = link
    hrefLabel.textContent = href
    popover.hidden = false

    const frameRect = frame.getBoundingClientRect()
    const linkRect = link.getBoundingClientRect()
    const popoverRect = popover.getBoundingClientRect()
    const padding = 10
    const maximumLeft = Math.max(padding, frameRect.width - popoverRect.width - padding)
    const left = Math.min(Math.max(linkRect.left - frameRect.left, padding), maximumLeft)
    const below = linkRect.bottom - frameRect.top + 8
    const above = linkRect.top - frameRect.top - popoverRect.height - 8
    const top = below + popoverRect.height <= frameRect.height - padding ? below : Math.max(padding, above)

    popover.style.left = `${left}px`
    popover.style.top = `${top}px`
  }, [])

  const syncToolbarState = useCallback(() => {
    const editor = editorRef.current
    const toolbar = toolbarRef.current
    if (!editor || !toolbar) return

    const selection = document.getSelection()
    const code = selectionIsInsideCodeBlock(editor, selection)
    const checklist = selectionIsInsideChecklist(editor, selection)
    const contact = isEditingAtomicForm(editor)

    if (contact) {
      ;(['bold', 'italic', 'paragraph', 'heading2', 'heading3', 'bulletList', 'orderedList', 'quote', 'link', 'code'] as ToolbarFormat[])
        .forEach((format) => setToolbarButtonState(toolbar, format, false))
      return
    }

    if (!selectionIsInsideEditor(editor, selection)) {
      ;(['bold', 'italic', 'paragraph', 'heading2', 'heading3', 'bulletList', 'orderedList', 'quote', 'link', 'code'] as ToolbarFormat[])
        .forEach((format) => setToolbarButtonState(toolbar, format, false))
      return
    }

    if (checklist) {
      ;(['bold', 'italic', 'paragraph', 'heading2', 'heading3', 'bulletList', 'orderedList', 'quote', 'link', 'code'] as ToolbarFormat[])
        .forEach((format) => setToolbarButtonState(toolbar, format, false))
      return
    }

    if (code) {
      ;(['bold', 'italic', 'paragraph', 'heading2', 'heading3', 'bulletList', 'orderedList', 'quote', 'link'] as ToolbarFormat[])
        .forEach((format) => setToolbarButtonState(toolbar, format, false))
      setToolbarButtonState(toolbar, 'code', true)
      return
    }

    const bulletList = document.queryCommandState('insertUnorderedList')
    const orderedList = document.queryCommandState('insertOrderedList')
    const block = normalizeFormatBlock(String(document.queryCommandValue('formatBlock') ?? ''))
    const heading2 = block === 'h2'
    const heading3 = block === 'h3'
    const quote = block === 'blockquote'
    const paragraph =
      !bulletList &&
      !orderedList &&
      !heading2 &&
      !heading3 &&
      !quote &&
      (block === 'p' || block === 'div' || block === '')

    setToolbarButtonState(toolbar, 'bold', document.queryCommandState('bold'))
    setToolbarButtonState(toolbar, 'italic', document.queryCommandState('italic'))
    setToolbarButtonState(toolbar, 'paragraph', paragraph)
    setToolbarButtonState(toolbar, 'heading2', heading2)
    setToolbarButtonState(toolbar, 'heading3', heading3)
    setToolbarButtonState(toolbar, 'bulletList', bulletList)
    setToolbarButtonState(toolbar, 'orderedList', orderedList)
    setToolbarButtonState(toolbar, 'quote', quote)
    setToolbarButtonState(toolbar, 'link', selectionHasLink(editor, selection))
    setToolbarButtonState(toolbar, 'code', false)
  }, [])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const observer = new MutationObserver(() => {
      if (restoringRef.current || editor.innerHTML !== '' || lastHtmlRef.current === '') return

      const wasFocused = document.activeElement === editor
      restoringRef.current = true
      editor.innerHTML = lastHtmlRef.current
      setEditorEmptyState(editor, parseEditorBlocks(editor))
      if (wasFocused) placeCaretAtEnd(editor)

      queueMicrotask(() => {
        restoringRef.current = false
      })
    })

    observer.observe(editor, {
      childList: true,
    })

    return () => observer.disconnect()
  }, [noteId])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    function handleCodeLanguageChange(event: Event) {
      const select = event.target
      if (!(select instanceof HTMLSelectElement) || !select.matches('[data-code-language="true"]')) {
        return
      }

      const block = select.closest<HTMLElement>('[data-code-block="true"]')
      if (!block) return

      const language = normalizeCodeLanguage(select.value)
      block.dataset.language = language
      select.value = language
      Array.from(select.options).forEach((option) => {
        option.toggleAttribute('selected', option.value === language)
      })
      emitChange()
    }

    editor.addEventListener('change', handleCodeLanguageChange)
    return () => editor.removeEventListener('change', handleCodeLanguageChange)
  }, [noteId])

  useEffect(() => {
    document.addEventListener('selectionchange', syncToolbarState)
    return () => document.removeEventListener('selectionchange', syncToolbarState)
  }, [syncToolbarState])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return

      const popover = linkPopoverRef.current
      const activeLink = activeLinkRef.current
      if (popover?.contains(target) || activeLink?.contains(target)) return

      hideLinkPopover()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') hideLinkPopover()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('scroll', hideLinkPopover, true)
    window.addEventListener('resize', hideLinkPopover)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('scroll', hideLinkPopover, true)
      window.removeEventListener('resize', hideLinkPopover)
    }
  }, [hideLinkPopover])

  function emitChange() {
    const editor = editorRef.current
    if (!editor) return

    lastHtmlRef.current = editor.innerHTML
    const blocks = parseEditorBlocks(editor)
    setEditorEmptyState(editor, blocks)
    onChange(blocks)
    syncToolbarState()
  }

  function runCommand(command: string, value?: string) {
    const editor = editorRef.current
    if (!editor) return

    const selection = document.getSelection()
    if (selectionIsInsideCodeBlock(editor, selection) || selectionIsInsideChecklist(editor, selection) || isEditingAtomicForm(editor)) return

    editor.focus()
    document.execCommand(command, false, value)
    emitChange()
    syncToolbarState()
  }

  function insertDailyEntryBlock() {
    const editor = editorRef.current
    if (!editor) return

    const today = localDateKey()
    const existing = Array.from(editor.querySelectorAll<HTMLElement>('[data-daily-entry-block="true"]'))
      .find((entry) => entry.dataset.dailyEntryDate === today)

    if (existing) {
      const title = existing.querySelector<HTMLInputElement>('[data-daily-entry-title="true"]')
      if (title && !title.value.trim()) {
        title.focus()
        return
      }

      let paragraph = editor.lastElementChild instanceof HTMLParagraphElement
        ? editor.lastElementChild
        : null
      if (!paragraph) {
        paragraph = createCaretParagraph()
        editor.append(paragraph)
        emitChange()
      }
      editor.focus()
      placeCaretAtEnd(paragraph)
      return
    }

    const [entry, paragraphBlock] = createDailyEntryBlocks()
    editor.insertAdjacentHTML('beforeend', `${dailyEntryBlockToHtml(entry)}<p data-block-id="${escapeHtml(paragraphBlock.id)}"><br></p>`)
    emitChange()

    const title = editor.querySelector<HTMLInputElement>(
      `[data-block-id="${entry.id}"] [data-daily-entry-title="true"]`,
    )
    title?.focus()
  }

  function insertChecklistBlock() {
    const editor = editorRef.current
    if (!editor) return

    const selection = document.getSelection()
    const selectedText = selectionIsInsideEditor(editor, selection) &&
      !selection.isCollapsed &&
      !selectionIsInsideCodeBlock(editor, selection) &&
      !selectionIsInsideChecklist(editor, selection)
      ? selection.toString()
      : ''
    const id = createBlockId()
    const nextParagraphId = createBlockId()
    const block: Extract<NoteBlock, { type: 'checklist' }> = {
      id,
      type: 'checklist',
      items: [{ text: selectedText, checked: false }],
    }
    const html = `${checklistBlockToHtml(block)}<p data-block-id="${nextParagraphId}"><br></p>`

    const atomicHost = atomicHostForInsertion(editor, selection)

    if (atomicHost) {
      atomicHost.insertAdjacentHTML('afterend', html)
    } else {
      editor.focus()
      document.execCommand('insertHTML', false, html)
    }
    emitChange()

    const itemText = editor.querySelector<HTMLElement>(
      `[data-block-id="${id}"] [data-checklist-text="true"]`,
    )
    if (itemText) {
      itemText.focus()
      placeCaretAtEnd(itemText)
      syncToolbarState()
    }
  }

  function insertContactBlock() {
    const editor = editorRef.current
    if (!editor) return

    const selection = document.getSelection()
    const id = createBlockId()
    const nextParagraphId = createBlockId()
    const block: Extract<NoteBlock, { type: 'contact' }> = {
      id,
      type: 'contact',
      name: '',
      phone: '',
      email: '',
      organization: '',
      notes: '',
    }
    const html = `${contactBlockToHtml(block)}<p data-block-id="${nextParagraphId}"><br></p>`
    const atomicHost = atomicHostForInsertion(editor, selection)

    if (atomicHost) {
      atomicHost.insertAdjacentHTML('afterend', html)
    } else {
      editor.focus()
      document.execCommand('insertHTML', false, html)
    }
    emitChange()

    const nameField = editor.querySelector<HTMLInputElement>(
      `[data-block-id="${id}"] [data-contact-field="name"]`,
    )
    nameField?.focus()
    syncToolbarState()
  }

  function insertCodeBlock() {
    const editor = editorRef.current
    if (!editor) return

    const selection = document.getSelection()
    const selectedText = selectionIsInsideEditor(editor, selection) && !selection.isCollapsed && !isEditingAtomicForm(editor)
      ? selection.toString()
      : ''
    const id = createBlockId()
    const nextParagraphId = createBlockId()
    const block: Extract<NoteBlock, { type: 'code' }> = {
      id,
      type: 'code',
      language: 'plaintext',
      text: selectedText,
    }
    const html = `${codeBlockToHtml(block)}<p data-block-id="${nextParagraphId}"><br></p>`
    const atomicHost = atomicHostForInsertion(editor, selection)

    if (atomicHost) {
      atomicHost.insertAdjacentHTML('afterend', html)
    } else {
      editor.focus()
      document.execCommand('insertHTML', false, html)
    }
    emitChange()

    const codeContent = editor.querySelector<HTMLElement>(
      `[data-block-id="${id}"] [data-code-content="true"]`,
    )
    if (codeContent) {
      codeContent.focus()
      placeCaretAtEnd(codeContent)
      syncToolbarState()
    }
  }

  function handleLink() {
    const editor = editorRef.current
    const selection = document.getSelection()
    if (!editor || !selection || selection.isCollapsed || selection.rangeCount === 0) return
    if (selectionIsInsideCodeBlock(editor, selection) || selectionIsInsideChecklist(editor, selection) || isEditingAtomicForm(editor)) return

    const range = selection.getRangeAt(0)
    if (!editor.contains(range.commonAncestorContainer)) return

    const rawValue = window.prompt('Escribe el enlace. Déjalo vacío para quitar un enlace existente.')
    if (rawValue === null) return

    if (!rawValue.trim()) {
      runCommand('unlink')
      return
    }

    const href = normalizeNoteLink(rawValue)
    if (!href) {
      window.alert('El enlace debe usar http, https, mailto o tel.')
      return
    }

    runCommand('createLink', href)
  }

  function handleEditorPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button != 0) return
    pointerStartRef.current = { x: event.clientX, y: event.clientY }
    pointerDraggedRef.current = false
  }

  function handleEditorPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pointerStartRef.current
    if (!start || (event.buttons & 1) === 0) return

    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y)
    if (distance > 4) pointerDraggedRef.current = true
  }

  function handleEditorPointerUp() {
    window.setTimeout(() => {
      pointerStartRef.current = null
      pointerDraggedRef.current = false
    }, 0)
  }

  async function handleEditorClick(event: MouseEvent<HTMLDivElement>) {
    const editor = editorRef.current
    if (!editor) return

    const target = event.target instanceof Element ? event.target : null
    const contactRemove = target?.closest<HTMLButtonElement>('[data-contact-remove="true"]')
    if (contactRemove && editor.contains(contactRemove)) {
      event.preventDefault()
      event.stopPropagation()
      const contact = contactRemove.closest<HTMLElement>('[data-contact-block="true"]')
      if (!contact) return
      if (!window.confirm('¿Eliminar esta ficha de contacto privada?')) return
      contact.remove()
      emitChange()
      return
    }

    const checklistToggle = target?.closest<HTMLButtonElement>('[data-checklist-toggle="true"]')
    if (checklistToggle && editor.contains(checklistToggle)) {
      event.preventDefault()
      event.stopPropagation()
      const item = checklistToggle.closest<HTMLElement>('[data-checklist-item="true"]')
      if (!item) return
      const checked = item.dataset.checked !== 'true'
      item.dataset.checked = String(checked)
      checklistToggle.setAttribute('aria-pressed', String(checked))
      checklistToggle.setAttribute(
        'aria-label',
        checked ? 'Marcar tarea como pendiente' : 'Marcar tarea como completada',
      )
      checklistToggle.textContent = checked ? '✓' : ''
      emitChange()
      return
    }

    const copyButton = target?.closest<HTMLButtonElement>('[data-code-copy="true"]')
    if (copyButton && editor.contains(copyButton)) {
      event.preventDefault()
      const block = codeBlockFromTarget(editor, copyButton)
      const code = codeTextFromElement(block?.querySelector<HTMLElement>('[data-code-content="true"]') ?? null)

      try {
        await copyText(code)
        const previous = copyButton.textContent
        copyButton.textContent = 'Copiado'
        window.setTimeout(() => {
          if (copyButton.isConnected) copyButton.textContent = previous || 'Copiar'
        }, 1200)
      } catch {
        window.alert('No se pudo copiar el código en este navegador.')
      }
      return
    }

    const emptyParagraph = target?.closest('p') ?? null
    if (isEmptyCaretParagraph(emptyParagraph) && editor.contains(emptyParagraph)) {
      hideLinkPopover()

      const selection = document.getSelection()
      if (pointerDraggedRef.current || (selection && !selection.isCollapsed)) {
        syncToolbarState()
        return
      }

      event.preventDefault()
      editor.focus()
      placeCaretAtStart(emptyParagraph)
      syncToolbarState()
      return
    }

    if (event.target === editor) {
      hideLinkPopover()

      const selection = document.getSelection()
      if (pointerDraggedRef.current || (selection && !selection.isCollapsed)) {
        syncToolbarState()
        return
      }

      event.preventDefault()
      const insertedParagraph = placeCaretFromEditorBackground(editor, event.clientY)
      if (insertedParagraph) emitChange()
      syncToolbarState()
      return
    }

    const link = linkFromTarget(editor, event.target)
    if (!link) {
      hideLinkPopover()
      return
    }

    const href = normalizeNoteLink(link.getAttribute('href') ?? '')
    event.preventDefault()
    if (!href) {
      hideLinkPopover()
      return
    }

    if (event.ctrlKey || event.metaKey) {
      hideLinkPopover()
      openSafeLink(href)
      return
    }

    showLinkPopover(link)
  }

  function handleOpenActiveLink() {
    const link = activeLinkRef.current
    if (!link) return

    openSafeLink(link.getAttribute('href') ?? '')
    hideLinkPopover()
  }

  function handleEditActiveLink() {
    const link = activeLinkRef.current
    if (!link) return

    const currentHref = normalizeNoteLink(link.getAttribute('href') ?? '') ?? ''
    const rawValue = window.prompt('Editar enlace. Déjalo vacío para quitarlo.', currentHref)
    if (rawValue === null) return

    if (!rawValue.trim()) {
      handleRemoveActiveLink()
      return
    }

    const href = normalizeNoteLink(rawValue)
    if (!href) {
      window.alert('El enlace debe usar http, https, mailto o tel.')
      return
    }

    link.setAttribute('href', href)
    link.setAttribute('rel', 'noopener noreferrer')
    emitChange()
    showLinkPopover(link)
  }

  function handleRemoveActiveLink() {
    const link = activeLinkRef.current
    const editor = editorRef.current
    const parent = link?.parentNode
    if (!link || !editor || !parent) return

    while (link.firstChild) {
      parent.insertBefore(link.firstChild, link)
    }
    parent.removeChild(link)

    hideLinkPopover()
    emitChange()
    editor.focus()
  }

  function handleEditorInput(event: ReactFormEvent<HTMLDivElement>) {
    const target = event.target
    if (target instanceof HTMLInputElement && target.dataset.dailyEntryTitle === 'true') {
      target.setAttribute('value', target.value)
    } else if (target instanceof HTMLInputElement && target.dataset.contactField) {
      target.setAttribute('value', target.value)
      if (target.dataset.contactField === 'name') {
        const card = target.closest<HTMLElement>('[data-contact-block="true"]')
        const avatar = card?.querySelector<HTMLElement>('[data-contact-avatar="true"]')
        if (avatar) avatar.textContent = contactInitial(target.value)
      }
    } else if (target instanceof HTMLTextAreaElement && target.dataset.contactField) {
      target.defaultValue = target.value
    }
    emitChange()
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const target = event.target
    if (target instanceof Element && target.closest('[data-contact-field], [data-daily-entry-title="true"]')) return

    const plainText = event.clipboardData.getData('text/plain')
    if (!plainText) return

    event.preventDefault()
    document.execCommand('insertText', false, plainText)
    emitChange()
  }

  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const editor = editorRef.current
    const target = event.target
    if (!editor || !(target instanceof Element)) return

    const dailyTitle = target.closest<HTMLInputElement>('[data-daily-entry-title="true"]')
    if (dailyTitle) {
      if (event.key === 'Enter') {
        event.preventDefault()
        const entry = dailyTitle.closest<HTMLElement>('[data-daily-entry-block="true"]')
        if (!entry) return
        let paragraph = entry.nextElementSibling instanceof HTMLParagraphElement
          ? entry.nextElementSibling
          : null
        if (!paragraph) {
          paragraph = createCaretParagraph()
          entry.after(paragraph)
          emitChange()
        }
        editor.focus()
        placeCaretAtStart(paragraph)
      }
      return
    }

    const contactField = target.closest<HTMLInputElement | HTMLTextAreaElement>('[data-contact-field]')
    if (contactField) {
      if (event.key === 'Enter' && contactField instanceof HTMLInputElement) {
        event.preventDefault()
        const card = contactField.closest<HTMLElement>('[data-contact-block="true"]')
        const fields = card
          ? Array.from(card.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-contact-field]'))
          : []
        const next = fields[fields.indexOf(contactField) + 1]
        next?.focus()
      }
      return
    }

    const checklistText = target.closest<HTMLElement>('[data-checklist-text="true"]')
    if (checklistText) {
      const item = checklistText.closest<HTMLElement>('[data-checklist-item="true"]')
      const checklist = checklistText.closest<HTMLElement>('[data-checklist-block="true"]')
      if (!item || !checklist) return

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        const nextItem = createChecklistItemElement({ text: '', checked: false })
        item.after(nextItem)
        emitChange()
        const nextText = nextItem.querySelector<HTMLElement>('[data-checklist-text="true"]')
        if (nextText) {
          nextText.focus()
          placeCaretAtStart(nextText)
        }
        return
      }

      if (event.key === 'Backspace' && /^\n*$/.test(codeTextFromElement(checklistText))) {
        const items = Array.from(checklist.children).filter(
          (child): child is HTMLElement =>
            child instanceof HTMLElement && child.dataset.checklistItem === 'true',
        )
        if (items.length > 1) {
          event.preventDefault()
          const index = items.indexOf(item)
          const focusItem = items[index - 1] ?? items[index + 1]
          item.remove()
          emitChange()
          const focusText = focusItem?.querySelector<HTMLElement>('[data-checklist-text="true"]')
          if (focusText) {
            focusText.focus()
            placeCaretAtEnd(focusText)
          }
        }
        return
      }

      return
    }

    if (event.key !== 'Tab' || !target.closest('[data-code-content="true"]')) return

    event.preventDefault()
    document.execCommand('insertText', false, '\t')
    emitChange()
  }

  const keepSelection = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault()

  return (
    <div ref={frameRef} className="editor-frame">
      <div ref={toolbarRef} className="editor-toolbar" role="toolbar" aria-label="Formato de texto">
        <button className="editor-tool editor-tool--strong" data-format="bold" aria-pressed="false" type="button" onMouseDown={keepSelection} onClick={() => runCommand('bold')} title="Negrita">
          B
        </button>
        <button className="editor-tool editor-tool--italic" data-format="italic" aria-pressed="false" type="button" onMouseDown={keepSelection} onClick={() => runCommand('italic')} title="Cursiva">
          I
        </button>
        <span className="editor-toolbar__separator" aria-hidden="true" />
        <button className="editor-tool" data-format="paragraph" aria-pressed="false" type="button" onMouseDown={keepSelection} onClick={() => runCommand('formatBlock', 'p')} title="Párrafo">
          P
        </button>
        <button className="editor-tool" data-format="heading2" aria-pressed="false" type="button" onMouseDown={keepSelection} onClick={() => runCommand('formatBlock', 'h2')} title="Encabezado grande">
          H2
        </button>
        <button className="editor-tool" data-format="heading3" aria-pressed="false" type="button" onMouseDown={keepSelection} onClick={() => runCommand('formatBlock', 'h3')} title="Encabezado pequeño">
          H3
        </button>
        <span className="editor-toolbar__separator" aria-hidden="true" />
        <button className="editor-tool" data-format="bulletList" aria-pressed="false" type="button" onMouseDown={keepSelection} onClick={() => runCommand('insertUnorderedList')} title="Lista con viñetas">
          • Lista
        </button>
        <button className="editor-tool" data-format="orderedList" aria-pressed="false" type="button" onMouseDown={keepSelection} onClick={() => runCommand('insertOrderedList')} title="Lista numerada">
          1. Lista
        </button>
        <button className="editor-tool" data-format="quote" aria-pressed="false" type="button" onMouseDown={keepSelection} onClick={() => runCommand('formatBlock', 'blockquote')} title="Cita">
          Cita
        </button>
        <button className="editor-tool" data-format="link" aria-pressed="false" type="button" onMouseDown={keepSelection} onClick={handleLink} title="Enlace">
          Enlace
        </button>
        <button className="editor-tool" data-format="code" aria-pressed="false" type="button" onMouseDown={keepSelection} onClick={insertCodeBlock} title="Bloque de código">
          Código
        </button>
        <button className="editor-tool" data-insert="dailyEntry" type="button" onMouseDown={keepSelection} onClick={insertDailyEntryBlock} title="Nueva entrada de hoy">
          ◷ Entrada
        </button>
        <button className="editor-tool" data-insert="checklist" type="button" onMouseDown={keepSelection} onClick={insertChecklistBlock} title="Checklist">
          ☑ Checklist
        </button>
        <button className="editor-tool" data-insert="contact" type="button" onMouseDown={keepSelection} onClick={insertContactBlock} title="Contacto privado">
          ◉ Contacto
        </button>
        <button className="editor-tool" type="button" onMouseDown={keepSelection} onClick={() => runCommand('insertHorizontalRule')} title="Separador">
          —
        </button>
      </div>

      <div
        ref={attachEditor}
        className="editor-surface"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Contenido de la nota"
        data-placeholder="Escribe algo…"
        onPointerDown={handleEditorPointerDown}
        onPointerMove={handleEditorPointerMove}
        onPointerUp={handleEditorPointerUp}
        onClick={handleEditorClick}
        onInput={handleEditorInput}
        onKeyDown={handleEditorKeyDown}
        onFocus={syncToolbarState}
        onKeyUp={syncToolbarState}
        onMouseUp={syncToolbarState}
        onBlur={onBlur}
        onPaste={handlePaste}
        spellCheck
      />

      <div
        ref={linkPopoverRef}
        className="editor-link-popover"
        role="dialog"
        aria-label="Acciones del enlace"
        hidden
      >
        <span ref={linkHrefRef} className="editor-link-popover__href" />
        <div className="editor-link-popover__actions">
          <button type="button" onMouseDown={keepSelection} onClick={handleOpenActiveLink}>Abrir</button>
          <button type="button" onMouseDown={keepSelection} onClick={handleEditActiveLink}>Editar</button>
          <button type="button" onMouseDown={keepSelection} onClick={handleRemoveActiveLink}>Quitar enlace</button>
        </div>
      </div>
    </div>
  )
}

export const RichTextEditor = RichTextEditorComponent
