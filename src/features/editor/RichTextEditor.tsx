import {
  useCallback,
  useEffect,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
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

function blocksToHtml(blocks: NoteBlock[]): string {
  if (blocks.length === 0) {
    return `<p data-block-id="${createBlockId()}"><br></p>`
  }

  return blocks
    .map((block) => {
      const id = escapeHtml(block.id)

      if (block.type === 'divider') return `<hr data-block-id="${id}">`
      if (block.type === 'code') return codeBlockToHtml(block)
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
  return element.dataset.codeBlock === 'true' || element.dataset.imageBlock === 'true'
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

    if (!selectionIsInsideEditor(editor, selection)) {
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
      subtree: true,
      characterData: true,
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
    if (selectionIsInsideCodeBlock(editor, selection)) return

    editor.focus()
    document.execCommand(command, false, value)
    emitChange()
    syncToolbarState()
  }

  function insertCodeBlock() {
    const editor = editorRef.current
    if (!editor) return

    const selection = document.getSelection()
    const selectedText = selectionIsInsideEditor(editor, selection) && !selection.isCollapsed
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

    editor.focus()
    document.execCommand(
      'insertHTML',
      false,
      `${codeBlockToHtml(block)}<p data-block-id="${nextParagraphId}"><br></p>`,
    )
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
    if (selectionIsInsideCodeBlock(editor, selection)) return

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

  async function handleEditorClick(event: MouseEvent<HTMLDivElement>) {
    const editor = editorRef.current
    if (!editor) return

    const target = event.target instanceof Element ? event.target : null
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

    if (event.target === editor) {
      hideLinkPopover()
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

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const plainText = event.clipboardData.getData('text/plain')
    if (!plainText) return

    event.preventDefault()
    document.execCommand('insertText', false, plainText)
    emitChange()
  }

  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') return
    const target = event.target
    if (!(target instanceof Element) || !target.closest('[data-code-content="true"]')) return

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
        onClick={handleEditorClick}
        onInput={emitChange}
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
