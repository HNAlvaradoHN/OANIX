import { useEffect } from 'react'

const ROW_HEIGHT_PX = 32
const MAX_LEADING_ROWS = 80
const LAYOUT_STORAGE_KEY = 'oanix.notebook.layout.v1'
const MAX_LAYOUT_ENTRIES = 500

interface StoredAnchor {
  rows: number
  updatedAt: number
}

type StoredAnchorMap = Record<string, StoredAnchor>

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
    // Layout is a local convenience only; storage restrictions must never block editing.
  }
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

function insertCaretAtBackgroundPoint(editor: HTMLElement, clientY: number, anchors: StoredAnchorMap) {
  const blocks = directBlocks(editor)
  const rowHeight = editorRowHeight(editor)
  const contentTop = editorContentTop(editor)
  let paragraph: HTMLParagraphElement
  let leadingRows = 0

  if (blocks.length === 0) {
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
        const previous = last.previousElementSibling
        const baseY = previous instanceof HTMLElement ? previous.getBoundingClientRect().bottom : contentTop
        leadingRows = rowGapFrom(baseY, clientY, rowHeight)
      } else {
        paragraph = createCaretParagraph()
        editor.append(paragraph)
        leadingRows = rowGapFrom(last.getBoundingClientRect().bottom, clientY, rowHeight)
      }
    }
  }

  saveAnchor(paragraph, leadingRows, anchors)
  editor.dataset.empty = 'false'
  editor.focus({ preventScroll: true })
  placeCaretAtStart(paragraph)
  flashTargetRow(paragraph)
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  window.setTimeout(() => keepCaretVisible(editor), 80)
  window.setTimeout(() => keepCaretVisible(editor), 260)
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

function keepCaretVisible(editor: HTMLElement) {
  const block = selectionBlock(editor)
  if (!block) return
  const viewport = window.visualViewport
  const top = viewport?.offsetTop ?? 0
  const height = viewport?.height ?? window.innerHeight
  const bottom = top + height
  const rect = block.getBoundingClientRect()
  const safeTop = top + 18
  const safeBottom = bottom - 96

  if (rect.bottom > safeBottom || rect.top < safeTop) {
    block.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
  }
}

export function NotebookCanvasRuntime() {
  useEffect(() => {
    if (import.meta.env.MODE === 'capacitor') return

    document.documentElement.classList.add('oanix-notebook-canvas-pwa')
    const anchors = readAnchorMap()
    let frame = 0
    let pointerMoved = false
    let pointerStart: { x: number; y: number } | null = null

    function scheduleRestore() {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        restoreAnchors(document, anchors)
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

    function handleBackgroundClick(event: MouseEvent) {
      const editor = event.target instanceof HTMLElement && event.target.matches('.editor-surface')
        ? event.target
        : null
      if (!editor || pointerMoved) return

      const selection = window.getSelection()
      if (selection && !selection.isCollapsed) return

      event.preventDefault()
      event.stopPropagation()
      insertCaretAtBackgroundPoint(editor, event.clientY, anchors)
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
    }

    const observer = new MutationObserver(scheduleRestore)
    observer.observe(document.body, { childList: true, subtree: true })
    restoreAnchors(document, anchors)

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('pointermove', handlePointerMove, true)
    document.addEventListener('pointerup', handlePointerEnd, true)
    document.addEventListener('pointercancel', handlePointerEnd, true)
    document.addEventListener('click', handleBackgroundClick, true)
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
      document.removeEventListener('click', handleBackgroundClick, true)
      document.removeEventListener('focusin', handleFocusIn, true)
      window.visualViewport?.removeEventListener('resize', handleViewportChange)
      window.visualViewport?.removeEventListener('scroll', handleViewportChange)
    }
  }, [])

  return null
}
