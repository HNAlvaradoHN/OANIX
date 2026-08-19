import { useEffect } from 'react'

const ROW_HEIGHT_PX = 32
const MAX_LEADING_ROWS = 80
const LAYOUT_STORAGE_KEY = 'oanix.notebook.layout.v3'
const NOTE_PAPER_STORAGE_KEY = 'oanix.note.paper.v1'
const LEGACY_PAPER_STORAGE_KEY = 'oanix.paper.mode'
const MAX_LAYOUT_ENTRIES = 500
const MOBILE_DOCK_ALLOWANCE_PX = 86

type PaperMode = 'plain' | 'ruled'

interface StoredAnchor {
  rows: number
  updatedAt: number
}

type StoredAnchorMap = Record<string, StoredAnchor>
type StoredPaperMap = Record<string, PaperMode>

function createBlockId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const bytes = new Uint8Array(16)
  globalThis.crypto?.getRandomValues?.(bytes)
  return Array.from(bytes).map((value) => value.toString(16).padStart(2, '0')).join('')
}

function readAnchorMap(): StoredAnchorMap {
  try {
    const value = JSON.parse(window.localStorage.getItem(LAYOUT_STORAGE_KEY) ?? '{}') as StoredAnchorMap
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

function writeAnchorMap(map: StoredAnchorMap) {
  try {
    const entries = Object.entries(map)
      .filter(([, value]) => Number.isSafeInteger(value?.rows) && value.rows > 0)
      .sort((left, right) => right[1].updatedAt - left[1].updatedAt)
      .slice(0, MAX_LAYOUT_ENTRIES)
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // Layout is only a local visual aid. Editing must keep working if storage is restricted.
  }
}

function readPaperMap(): StoredPaperMap {
  try {
    const value = JSON.parse(window.localStorage.getItem(NOTE_PAPER_STORAGE_KEY) ?? '{}') as StoredPaperMap
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

function writePaperMap(map: StoredPaperMap) {
  try {
    window.localStorage.setItem(NOTE_PAPER_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Paper style is a local preference and must never block note editing.
  }
}

function legacyPaperMode(): PaperMode {
  try {
    return window.localStorage.getItem(LEGACY_PAPER_STORAGE_KEY) === 'ruled' ? 'ruled' : 'plain'
  } catch {
    return 'plain'
  }
}

function currentHistoryNoteId(): string | null {
  const state = window.history.state
  if (!state || typeof state !== 'object') return null
  const noteId = (state as { noteId?: unknown }).noteId
  return typeof noteId === 'string' && noteId.length > 0 ? noteId : null
}

function noteKeyForEditor(editor: HTMLElement): string {
  const explicit = editor.closest<HTMLElement>('.image-note-editor-root')?.dataset.noteId
  if (explicit) return explicit

  const historyId = currentHistoryNoteId()
  if (historyId) return historyId

  const firstBlock = Array.from(editor.children).find(
    (child): child is HTMLElement => child instanceof HTMLElement && !!child.dataset.blockId,
  )
  return firstBlock?.dataset.blockId ? `block:${firstBlock.dataset.blockId}` : 'current-note'
}

function paperModeForEditor(editor: HTMLElement, paperMap: StoredPaperMap): PaperMode {
  return paperMap[noteKeyForEditor(editor)] ?? legacyPaperMode()
}

function editorRowHeight(editor: HTMLElement): number {
  const raw = getComputedStyle(editor).getPropertyValue('--oanix-notebook-row').trim()
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) && parsed >= 20 ? parsed : ROW_HEIGHT_PX
}

function editorContentTop(editor: HTMLElement): number {
  const rect = editor.getBoundingClientRect()
  const paddingTop = Number.parseFloat(getComputedStyle(editor).paddingTop) || 0
  return rect.top + paddingTop
}

function canvasStartY(editor: HTMLElement): number {
  const dailyEntries = Array.from(editor.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.dataset.dailyEntryBlock === 'true',
  )
  return dailyEntries.at(-1)?.getBoundingClientRect().bottom ?? editorContentTop(editor)
}

function directBlocks(editor: HTMLElement): HTMLElement[] {
  return Array.from(editor.children).filter((child): child is HTMLElement => child instanceof HTMLElement)
}

function emptyParagraph(element: Element | null): element is HTMLParagraphElement {
  return element instanceof HTMLParagraphElement && (element.textContent ?? '').trim() === ''
}

function applyAnchor(paragraph: HTMLParagraphElement, rows: number) {
  const safeRows = Math.max(0, Math.min(MAX_LEADING_ROWS, Math.round(rows)))
  if (safeRows <= 0) {
    delete paragraph.dataset.oanixLeadingRows
    paragraph.style.removeProperty('padding-top')
    return
  }

  paragraph.dataset.oanixLeadingRows = String(safeRows)
  paragraph.style.paddingTop = `${safeRows * editorRowHeight(paragraph.closest<HTMLElement>('.editor-surface') ?? paragraph)}px`
}

function restoreAnchors(root: ParentNode, anchors: StoredAnchorMap) {
  root.querySelectorAll<HTMLParagraphElement>('.editor-surface > p[data-block-id]').forEach((paragraph) => {
    const blockId = paragraph.dataset.blockId
    if (!blockId) return
    const stored = anchors[blockId]
    if (stored?.rows) applyAnchor(paragraph, stored.rows)
  })
}

function saveAnchor(paragraph: HTMLParagraphElement, rows: number, anchors: StoredAnchorMap) {
  const blockId = paragraph.dataset.blockId
  if (!blockId) return
  const safeRows = Math.max(0, Math.min(MAX_LEADING_ROWS, Math.round(rows)))
  if (safeRows > 0) {
    anchors[blockId] = { rows: safeRows, updatedAt: Date.now() }
  } else {
    delete anchors[blockId]
  }
  applyAnchor(paragraph, safeRows)
  writeAnchorMap(anchors)
}

function createCaretParagraph(): HTMLParagraphElement {
  const paragraph = document.createElement('p')
  paragraph.dataset.blockId = createBlockId()
  paragraph.append(document.createElement('br'))
  return paragraph
}

function placeCaretAtStart(paragraph: HTMLParagraphElement) {
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.selectNodeContents(paragraph)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

function flashTargetRow(paragraph: HTMLParagraphElement) {
  paragraph.dataset.oanixRowTarget = 'true'
  window.setTimeout(() => {
    if (paragraph.isConnected) delete paragraph.dataset.oanixRowTarget
  }, 650)
}

function rowGapFrom(baseY: number, clientY: number, rowHeight: number): number {
  if (clientY <= baseY + rowHeight * 0.45) return 0
  return Math.max(0, Math.min(MAX_LEADING_ROWS, Math.round((clientY - baseY) / rowHeight) - 1))
}

function previousBlockBottom(paragraph: HTMLParagraphElement, fallback: number): number {
  const previous = paragraph.previousElementSibling
  return previous instanceof HTMLElement ? previous.getBoundingClientRect().bottom : fallback
}

interface ImagePointContext {
  kind: 'none' | 'blocked' | 'side'
  figure?: HTMLElement
}

function imageContextAtPoint(editor: HTMLElement, clientX: number, clientY: number): ImagePointContext {
  for (const figure of directBlocks(editor)) {
    if (figure.dataset.imageBlock !== 'true') continue
    const rect = figure.getBoundingClientRect()
    if (clientY < rect.top - 4 || clientY > rect.bottom + 4) continue

    const alignment = figure.dataset.imageAlignment ?? 'center'
    const compact = figure.dataset.imageCompact === 'true'

    if (alignment === 'center' || !compact) return { kind: 'blocked', figure }

    const xInsideImage = clientX >= rect.left - 8 && clientX <= rect.right + 8
    if (xInsideImage) return { kind: 'blocked', figure }

    return { kind: 'side', figure }
  }

  return { kind: 'none' }
}

function paragraphAfterSideImage(figure: HTMLElement): HTMLParagraphElement {
  const next = figure.nextElementSibling
  if (emptyParagraph(next)) return next

  const paragraph = createCaretParagraph()
  figure.after(paragraph)
  return paragraph
}

function prepareCaret(paragraph: HTMLParagraphElement, leadingRows: number, anchors: StoredAnchorMap) {
  const editor = paragraph.closest<HTMLElement>('.editor-surface')
  if (!editor) return

  saveAnchor(paragraph, leadingRows, anchors)
  editor.dataset.empty = 'false'
  editor.focus({ preventScroll: true })
  placeCaretAtStart(paragraph)
  flashTargetRow(paragraph)
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  window.setTimeout(() => keepCaretVisible(editor), 80)
  window.setTimeout(() => keepCaretVisible(editor), 260)
}

function insertCaretBesideImage(
  editor: HTMLElement,
  figure: HTMLElement,
  clientY: number,
  anchors: StoredAnchorMap,
): boolean {
  const rect = figure.getBoundingClientRect()
  const rowHeight = editorRowHeight(editor)
  const paragraph = paragraphAfterSideImage(figure)
  const targetRow = Math.max(0, Math.min(MAX_LEADING_ROWS, Math.floor((clientY - rect.top) / rowHeight)))
  prepareCaret(paragraph, targetRow, anchors)
  return true
}

function insertCaretAtCanvasPoint(
  editor: HTMLElement,
  clientX: number,
  clientY: number,
  anchors: StoredAnchorMap,
): boolean {
  if (clientY < canvasStartY(editor)) return false

  const imageContext = imageContextAtPoint(editor, clientX, clientY)
  if (imageContext.kind === 'blocked') return false
  if (imageContext.kind === 'side' && imageContext.figure) {
    return insertCaretBesideImage(editor, imageContext.figure, clientY, anchors)
  }

  const blocks = directBlocks(editor)
  const rowHeight = editorRowHeight(editor)
  const contentTop = editorContentTop(editor)
  let paragraph: HTMLParagraphElement
  let leadingRows = 0

  const blankAtPoint = blocks.find((block) => {
    if (!emptyParagraph(block)) return false
    const rect = block.getBoundingClientRect()
    return clientY >= rect.top && clientY <= rect.bottom
  })

  if (blankAtPoint && emptyParagraph(blankAtPoint)) {
    paragraph = blankAtPoint
    leadingRows = rowGapFrom(previousBlockBottom(paragraph, contentTop), clientY, rowHeight)
  } else if (blocks.length === 0) {
    paragraph = createCaretParagraph()
    editor.append(paragraph)
    leadingRows = Math.max(0, Math.round((clientY - contentTop) / rowHeight))
  } else {
    const nextIndex = blocks.findIndex((block) => clientY < block.getBoundingClientRect().top)

    if (nextIndex === 0) {
      const first = blocks[0]
      if (emptyParagraph(first)) {
        paragraph = first
      } else {
        paragraph = createCaretParagraph()
        first.before(paragraph)
      }
      leadingRows = Math.max(0, Math.round((clientY - contentTop) / rowHeight))
    } else if (nextIndex > 0) {
      const previous = blocks[nextIndex - 1]
      const next = blocks[nextIndex]
      if (emptyParagraph(next)) {
        paragraph = next
      } else {
        paragraph = createCaretParagraph()
        next.before(paragraph)
      }
      leadingRows = rowGapFrom(previous.getBoundingClientRect().bottom, clientY, rowHeight)
    } else {
      const last = blocks.at(-1)!
      if (emptyParagraph(last)) {
        paragraph = last
        leadingRows = rowGapFrom(previousBlockBottom(paragraph, contentTop), clientY, rowHeight)
      } else {
        paragraph = createCaretParagraph()
        editor.append(paragraph)
        leadingRows = rowGapFrom(last.getBoundingClientRect().bottom, clientY, rowHeight)
      }
    }
  }

  prepareCaret(paragraph, leadingRows, anchors)
  return true
}

function selectionBlock(editor: HTMLElement): HTMLElement | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  let element: Element | null = selection.anchorNode instanceof Element
    ? selection.anchorNode
    : selection.anchorNode?.parentElement ?? null
  while (element && element.parentElement !== editor) element = element.parentElement
  return element instanceof HTMLElement ? element : null
}

function caretBounds(editor: HTMLElement): { top: number; bottom: number } | null {
  const block = selectionBlock(editor)
  if (!block) return null

  const rect = block.getBoundingClientRect()
  const style = getComputedStyle(block)
  const paddingTop = Number.parseFloat(style.paddingTop) || 0
  const rowHeight = editorRowHeight(editor)
  const top = rect.top + paddingTop
  return { top, bottom: top + rowHeight }
}

function keepCaretVisible(editor: HTMLElement) {
  const bounds = caretBounds(editor)
  if (!bounds) return
  const viewport = window.visualViewport
  const top = viewport?.offsetTop ?? 0
  const height = viewport?.height ?? window.innerHeight
  const bottom = top + height
  const safeTop = top + 18
  const safeBottom = bottom - MOBILE_DOCK_ALLOWANCE_PX

  if (bounds.bottom > safeBottom || bounds.top < safeTop) {
    const block = selectionBlock(editor)
    block?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
  }
}

function directChildForTarget(editor: HTMLElement, target: Element): HTMLElement | null {
  let current: Element | null = target
  while (current && current.parentElement !== editor) current = current.parentElement
  return current instanceof HTMLElement ? current : null
}

function editorForCanvasTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const editor = target.closest<HTMLElement>('.editor-surface')
  if (!editor) return null

  const blocked = target.closest(
    'button, input, textarea, select, a, [data-image-block="true"], [data-code-block="true"], [data-checklist-block="true"], [data-contact-block="true"], [data-daily-entry-block="true"]',
  )
  if (blocked && editor.contains(blocked)) return null
  if (target === editor) return editor

  const direct = directChildForTarget(editor, target)
  return emptyParagraph(direct) ? editor : null
}

function setPaperMode(editor: HTMLElement, mode: PaperMode, paperMap: StoredPaperMap, save: boolean) {
  editor.dataset.oanixPaperMode = mode
  if (save) {
    paperMap[noteKeyForEditor(editor)] = mode
    writePaperMap(paperMap)
  }

  const root = editor.closest<HTMLElement>('.image-note-editor-root')
  root?.querySelectorAll<HTMLButtonElement>('[data-oanix-note-paper-toggle="true"]').forEach((button) => {
    const ruled = mode === 'ruled'
    button.setAttribute('aria-pressed', String(ruled))
    button.setAttribute('aria-label', ruled ? 'Ocultar renglones de esta nota' : 'Mostrar renglones de esta nota')
    button.title = ruled ? 'Ocultar renglones' : 'Mostrar renglones'
    if (button.dataset.oanixPaperToolbar === 'true') {
      button.textContent = ruled ? '▤ Renglones' : '▤ Hoja lisa'
    } else {
      button.textContent = '▤'
    }
  })
}

function createPaperToggle(toolbar = false): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.dataset.oanixNotePaperToggle = 'true'
  button.dataset.oanixPaperToolbar = String(toolbar)
  button.className = toolbar
    ? 'editor-tool oanix-note-paper-toggle oanix-note-paper-toggle--toolbar'
    : 'oanix-note-paper-toggle oanix-note-paper-toggle--dock'
  return button
}

function ensurePaperControls(root: HTMLElement, paperMap: StoredPaperMap) {
  const editor = root.querySelector<HTMLElement>('.editor-surface')
  if (!editor) return

  const mode = paperModeForEditor(editor, paperMap)
  if (!editor.dataset.oanixPaperMode) editor.dataset.oanixPaperMode = mode

  const dock = root.querySelector<HTMLElement>('.mobile-editor-dock')
  if (dock && !dock.querySelector('[data-oanix-note-paper-toggle="true"]')) {
    dock.insertBefore(createPaperToggle(false), dock.querySelector('.mobile-editor-dock__format'))
  }

  const toolbar = root.querySelector<HTMLElement>('.editor-toolbar')
  if (toolbar && !toolbar.querySelector('[data-oanix-note-paper-toggle="true"]')) {
    toolbar.append(createPaperToggle(true))
  }

  setPaperMode(editor, editor.dataset.oanixPaperMode === 'ruled' ? 'ruled' : 'plain', paperMap, false)
}

function scrollableAncestor(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement
  while (parent && parent !== document.body) {
    const style = getComputedStyle(parent)
    const scrollable = /(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 2
    if (scrollable) return parent
    parent = parent.parentElement
  }
  return null
}

function centerImageAbovePanel(figure: HTMLElement, panelHeight: number) {
  const viewport = window.visualViewport
  const viewportTop = viewport?.offsetTop ?? 0
  const viewportHeight = viewport?.height ?? window.innerHeight
  const safeTop = viewportTop + 18
  const safeBottom = viewportTop + viewportHeight - panelHeight - MOBILE_DOCK_ALLOWANCE_PX - 14

  if (safeBottom <= safeTop + 100) {
    figure.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
    return
  }

  const figureRect = figure.getBoundingClientRect()
  const actualCenter = (figureRect.top + figureRect.bottom) / 2
  const desiredCenter = (safeTop + safeBottom) / 2
  const delta = actualCenter - desiredCenter
  if (Math.abs(delta) < 8) return

  const scroller = scrollableAncestor(figure)
  if (scroller) {
    scroller.scrollBy({ top: delta, behavior: 'smooth' })
  } else {
    window.scrollBy({ top: delta, behavior: 'smooth' })
  }
}

function closeImagePanelSpacing(root: HTMLElement) {
  delete root.dataset.oanixImagePanelOpen
  root.style.removeProperty('--oanix-image-panel-height')
}

function syncImagePanelGeometry(figure: HTMLElement) {
  const root = figure.closest<HTMLElement>('.image-note-editor-root')
  if (!root) return

  if (figure.dataset.imageInfoOpen !== 'true') {
    closeImagePanelSpacing(root)
    return
  }

  root.dataset.oanixImagePanelOpen = 'true'
  window.requestAnimationFrame(() => {
    if (!figure.isConnected || figure.dataset.imageInfoOpen !== 'true') return
    const panel = figure.querySelector<HTMLElement>('.editor-image-block__footer')
    const panelHeight = Math.max(0, Math.ceil(panel?.getBoundingClientRect().height ?? 0))
    root.style.setProperty('--oanix-image-panel-height', `${panelHeight}px`)
    window.setTimeout(() => centerImageAbovePanel(figure, panelHeight), 40)
  })
}

export function NotebookCanvasRuntime() {
  useEffect(() => {
    if (import.meta.env.MODE === 'capacitor') return

    document.documentElement.classList.add('oanix-notebook-canvas-pwa')
    const anchors = readAnchorMap()
    const paperMap = readPaperMap()
    let frame = 0
    let pointerMoved = false
    let pointerStart: { x: number; y: number } | null = null

    function syncRuntime() {
      restoreAnchors(document, anchors)
      document.querySelectorAll<HTMLElement>('.image-note-editor-root').forEach((root) => {
        ensurePaperControls(root, paperMap)
      })
    }

    function scheduleSync() {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        syncRuntime()
      })
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0) return
      pointerStart = { x: event.clientX, y: event.clientY }
      pointerMoved = false
    }

    function handlePointerMove(event: PointerEvent) {
      if (!pointerStart) return
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) pointerMoved = true
    }

    function handlePointerEnd() {
      window.setTimeout(() => {
        pointerStart = null
        pointerMoved = false
      }, 0)
    }

    function handlePaperToggle(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      const button = target.closest<HTMLButtonElement>('[data-oanix-note-paper-toggle="true"]')
      if (!button) return
      const root = button.closest<HTMLElement>('.image-note-editor-root')
      const editor = root?.querySelector<HTMLElement>('.editor-surface')
      if (!editor) return

      event.preventDefault()
      event.stopPropagation()
      const next: PaperMode = editor.dataset.oanixPaperMode === 'ruled' ? 'plain' : 'ruled'
      setPaperMode(editor, next, paperMap, true)
    }

    function handleCanvasClick(event: MouseEvent) {
      if (pointerMoved) return
      const editor = editorForCanvasTarget(event.target)
      if (!editor) return

      const selection = window.getSelection()
      if (selection && !selection.isCollapsed) return

      const handled = insertCaretAtCanvasPoint(editor, event.clientX, event.clientY, anchors)
      if (!handled) return
      event.preventDefault()
      event.stopPropagation()
    }

    function handleImagePanelClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      const info = target.closest<HTMLElement>('[data-image-info="true"]')
      const figure = info?.closest<HTMLElement>('[data-image-block="true"]')
      if (!figure) return
      window.requestAnimationFrame(() => syncImagePanelGeometry(figure))
    }

    function handleFocusIn(event: FocusEvent) {
      const target = event.target
      const editor = target instanceof Element ? target.closest<HTMLElement>('.editor-surface') : null
      if (!editor) return
      window.setTimeout(() => keepCaretVisible(editor), 80)
    }

    function handleViewportChange() {
      const active = document.activeElement
      const editor = active instanceof Element
        ? active.closest<HTMLElement>('.editor-surface')
        : document.querySelector<HTMLElement>('.editor-surface:focus')
      if (editor) window.setTimeout(() => keepCaretVisible(editor), 40)

      const openFigure = document.querySelector<HTMLElement>('[data-image-block="true"][data-image-info-open="true"]')
      if (openFigure) syncImagePanelGeometry(openFigure)
    }

    const observer = new MutationObserver(scheduleSync)
    observer.observe(document.body, { childList: true, subtree: true })
    syncRuntime()

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('pointermove', handlePointerMove, true)
    document.addEventListener('pointerup', handlePointerEnd, true)
    document.addEventListener('pointercancel', handlePointerEnd, true)
    document.addEventListener('click', handlePaperToggle, true)
    document.addEventListener('click', handleCanvasClick, true)
    document.addEventListener('click', handleImagePanelClick)
    document.addEventListener('focusin', handleFocusIn, true)
    window.visualViewport?.addEventListener('resize', handleViewportChange)
    window.visualViewport?.addEventListener('scroll', handleViewportChange)

    return () => {
      document.documentElement.classList.remove('oanix-notebook-canvas-pwa')
      if (frame) window.cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerup', handlePointerEnd, true)
      document.removeEventListener('pointercancel', handlePointerEnd, true)
      document.removeEventListener('click', handlePaperToggle, true)
      document.removeEventListener('click', handleCanvasClick, true)
      document.removeEventListener('click', handleImagePanelClick)
      document.removeEventListener('focusin', handleFocusIn, true)
      window.visualViewport?.removeEventListener('resize', handleViewportChange)
      window.visualViewport?.removeEventListener('scroll', handleViewportChange)
    }
  }, [])

  return null
}
