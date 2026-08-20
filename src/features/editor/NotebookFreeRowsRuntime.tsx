import { useLayoutEffect } from 'react'

const ROW_HEIGHT_PX = 32
const LAYOUT_STORAGE_KEY = 'oanix.notebook.layout.v3'

type StoredAnchorMap = Record<string, { rows: number; updatedAt: number }>

function readAnchors(): StoredAnchorMap {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LAYOUT_STORAGE_KEY) ?? '{}') as StoredAnchorMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAnchors(anchors: StoredAnchorMap) {
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(anchors))
  } catch {
    // Free-row editing must keep working even if localStorage is unavailable.
  }
}

function rowHeight(editor: HTMLElement): number {
  const parsed = Number.parseFloat(getComputedStyle(editor).getPropertyValue('--oanix-notebook-row'))
  return Number.isFinite(parsed) && parsed >= 20 ? parsed : ROW_HEIGHT_PX
}

function leadingRows(paragraph: HTMLParagraphElement): number {
  const parsed = Number.parseInt(paragraph.dataset.oanixLeadingRows ?? '0', 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0
}

function setLeadingRows(paragraph: HTMLParagraphElement, rows: number, anchors: StoredAnchorMap) {
  const safeRows = Math.max(0, Math.round(rows))
  const editor = paragraph.closest<HTMLElement>('.editor-surface')
  if (!editor) return

  if (safeRows === 0) {
    delete paragraph.dataset.oanixLeadingRows
    paragraph.style.removeProperty('padding-top')
  } else {
    paragraph.dataset.oanixLeadingRows = String(safeRows)
    paragraph.style.paddingTop = `${safeRows * rowHeight(editor)}px`
  }

  const blockId = paragraph.dataset.blockId
  if (blockId) {
    if (safeRows === 0) delete anchors[blockId]
    else anchors[blockId] = { rows: safeRows, updatedAt: Date.now() }
  }
}

function createParagraph(): HTMLParagraphElement {
  const paragraph = document.createElement('p')
  paragraph.dataset.blockId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  paragraph.append(document.createElement('br'))
  return paragraph
}

function placeCaret(paragraph: HTMLParagraphElement) {
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.selectNodeContents(paragraph)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)

  const editor = paragraph.closest<HTMLElement>('.editor-surface')
  editor?.focus({ preventScroll: true })
  editor?.dispatchEvent(new Event('input', { bubbles: true }))
}

function paragraphPaddingHit(editor: HTMLElement, clientY: number): HTMLParagraphElement | null {
  for (const child of Array.from(editor.children)) {
    if (!(child instanceof HTMLParagraphElement)) continue
    const rows = leadingRows(child)
    if (rows <= 0) continue
    const rect = child.getBoundingClientRect()
    const paddingBottom = rect.top + rows * rowHeight(editor)
    if (clientY >= rect.top && clientY < paddingBottom) return child
  }
  return null
}

function splitAnchoredGap(editor: HTMLElement, next: HTMLParagraphElement, clientY: number, anchors: StoredAnchorMap): boolean {
  const rows = leadingRows(next)
  if (rows <= 0) return false

  const rect = next.getBoundingClientRect()
  const targetRow = Math.max(0, Math.min(rows - 1, Math.floor((clientY - rect.top) / rowHeight(editor))))
  const inserted = createParagraph()
  next.before(inserted)

  // Preserve the total vertical distance: the new paragraph consumes one logical row,
  // while the remaining empty rows stay attached to the original paragraph below.
  setLeadingRows(inserted, targetRow, anchors)
  setLeadingRows(next, rows - targetRow - 1, anchors)
  writeAnchors(anchors)
  placeCaret(inserted)
  return true
}

function isInsideBlockedContent(target: Element, editor: HTMLElement): boolean {
  const blocked = target.closest(
    'button, input, textarea, select, a, [data-code-block="true"], [data-checklist-block="true"], [data-contact-block="true"], [data-daily-entry-block="true"]',
  )
  return !!blocked && editor.contains(blocked)
}

export function NotebookFreeRowsRuntime() {
  useLayoutEffect(() => {
    if (import.meta.env.MODE === 'capacitor') return

    const anchors = readAnchors()

    function handleClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      const editor = target.closest<HTMLElement>('.editor-surface')
      if (!editor || isInsideBlockedContent(target, editor)) return

      const image = target.closest<HTMLElement>('[data-image-block="true"]')
      if (image && editor.contains(image)) return

      const paragraph = paragraphPaddingHit(editor, event.clientY)
      if (!paragraph) return

      if (!splitAnchoredGap(editor, paragraph, event.clientY, anchors)) return
      event.preventDefault()
      event.stopImmediatePropagation()
    }

    // The previous runtime keeps the caret visible when the visual viewport scrolls.
    // On mobile that fights the user's finger and snaps the sheet back. Resize still
    // handles the keyboard opening; scroll itself is left completely under user control.
    function allowManualViewportScroll(event: Event) {
      event.stopImmediatePropagation()
    }

    document.addEventListener('click', handleClick, true)
    window.visualViewport?.addEventListener('scroll', allowManualViewportScroll, true)

    return () => {
      document.removeEventListener('click', handleClick, true)
      window.visualViewport?.removeEventListener('scroll', allowManualViewportScroll, true)
    }
  }, [])

  return null
}
