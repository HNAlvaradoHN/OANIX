import { useLayoutEffect } from 'react'

const ROW_HEIGHT_PX = 32
const ROW_STORAGE_KEY = 'oanix.notebook.rows.v6'

type RowMap = Record<string, number>

function readRows(): RowMap {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ROW_STORAGE_KEY) ?? '{}') as RowMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeRows(rows: RowMap) {
  try {
    window.localStorage.setItem(ROW_STORAGE_KEY, JSON.stringify(rows))
  } catch {
    // Layout metadata is optional; editing must still work if storage is unavailable.
  }
}

function rowHeight(editor: HTMLElement): number {
  const value = Number.parseFloat(getComputedStyle(editor).getPropertyValue('--oanix-notebook-row'))
  return Number.isFinite(value) && value >= 20 ? value : ROW_HEIGHT_PX
}

function canvasTop(editor: HTMLElement): number {
  const directDailyEntries = Array.from(editor.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && child.dataset.dailyEntryBlock === 'true',
  )
  const lastDaily = directDailyEntries.at(-1)
  return lastDaily?.getBoundingClientRect().bottom ?? editor.getBoundingClientRect().top
}

function paragraphId(paragraph: HTMLParagraphElement): string {
  const current = paragraph.dataset.blockId
  if (current) return current
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  paragraph.dataset.blockId = id
  return id
}

function createParagraph(): HTMLParagraphElement {
  const paragraph = document.createElement('p')
  paragraph.dataset.blockId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  paragraph.append(document.createElement('br'))
  return paragraph
}

function directParagraphs(editor: HTMLElement): HTMLParagraphElement[] {
  return Array.from(editor.children).filter((child): child is HTMLParagraphElement => child instanceof HTMLParagraphElement)
}

function contentRows(paragraph: HTMLParagraphElement, rowPx: number): number {
  const padding = Number.parseFloat(paragraph.style.paddingTop || '0') || 0
  return Math.max(1, Math.ceil(Math.max(rowPx, paragraph.scrollHeight - padding) / rowPx))
}

function migrateVisualRows(editor: HTMLElement, rows: RowMap) {
  const top = canvasTop(editor)
  const rowPx = rowHeight(editor)
  let changed = false
  for (const paragraph of directParagraphs(editor)) {
    const id = paragraphId(paragraph)
    if (Number.isSafeInteger(rows[id]) && rows[id] >= 0) continue
    rows[id] = Math.max(0, Math.round((paragraph.getBoundingClientRect().top - top) / rowPx))
    changed = true
  }
  if (changed) writeRows(rows)
}

function applyLogicalLayout(editor: HTMLElement, rows: RowMap) {
  migrateVisualRows(editor, rows)
  const rowPx = rowHeight(editor)
  let previousBottomRow = 0

  for (const paragraph of directParagraphs(editor)) {
    const id = paragraphId(paragraph)
    const desiredRow = Math.max(0, rows[id] ?? previousBottomRow)
    const gapRows = Math.max(0, desiredRow - previousBottomRow)
    paragraph.dataset.oanixLogicalRow = String(desiredRow)
    paragraph.dataset.oanixLeadingRows = gapRows > 0 ? String(gapRows) : ''
    if (gapRows > 0) paragraph.style.paddingTop = `${gapRows * rowPx}px`
    else paragraph.style.removeProperty('padding-top')
    previousBottomRow = Math.max(previousBottomRow, desiredRow + contentRows(paragraph, rowPx))
  }
}

function rowAtPoint(editor: HTMLElement, clientY: number): number {
  return Math.max(0, Math.floor((clientY - canvasTop(editor)) / rowHeight(editor)))
}

function paragraphOccupiesRow(paragraph: HTMLParagraphElement, row: number, rowPx: number): boolean {
  const start = Number.parseInt(paragraph.dataset.oanixLogicalRow ?? '-1', 10)
  if (!Number.isSafeInteger(start) || start < 0) return false
  const length = contentRows(paragraph, rowPx)
  return row >= start && row < start + length
}

function insertParagraphAtRow(editor: HTMLElement, targetRow: number, rows: RowMap): HTMLParagraphElement | null {
  const rowPx = rowHeight(editor)
  const paragraphs = directParagraphs(editor)
  if (paragraphs.some((paragraph) => paragraphOccupiesRow(paragraph, targetRow, rowPx))) return null

  const inserted = createParagraph()
  rows[paragraphId(inserted)] = targetRow

  const next = paragraphs.find((paragraph) => {
    const row = Number.parseInt(paragraph.dataset.oanixLogicalRow ?? '0', 10)
    return Number.isSafeInteger(row) && row > targetRow
  })
  if (next) next.before(inserted)
  else editor.append(inserted)

  writeRows(rows)
  applyLogicalLayout(editor, rows)
  return inserted
}

function placeCaret(paragraph: HTMLParagraphElement) {
  const editor = paragraph.closest<HTMLElement>('.editor-surface')
  const selection = window.getSelection()
  if (!editor || !selection) return
  const range = document.createRange()
  range.selectNodeContents(paragraph)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
  editor.focus({ preventScroll: true })
  editor.dispatchEvent(new Event('input', { bubbles: true }))
}

function blockedTarget(target: Element, editor: HTMLElement): boolean {
  const blocked = target.closest(
    'button, input, textarea, select, a, [data-code-block="true"], [data-checklist-block="true"], [data-contact-block="true"], [data-daily-entry-block="true"], [data-image-block="true"]',
  )
  return !!blocked && editor.contains(blocked)
}

function shiftRowsAfter(rows: RowMap, row: number, amount: number) {
  for (const [id, value] of Object.entries(rows)) {
    if (Number.isSafeInteger(value) && value > row) rows[id] = value + amount
  }
}

export function NotebookFreeRowsRuntime() {
  useLayoutEffect(() => {
    if (import.meta.env.MODE === 'capacitor') return

    const rows = readRows()
    let frame = 0
    const sync = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = 0
        document.querySelectorAll<HTMLElement>('.editor-surface').forEach((editor) => applyLogicalLayout(editor, rows))
      })
    }

    function handleClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      const editor = target.closest<HTMLElement>('.editor-surface')
      if (!editor || blockedTarget(target, editor)) return
      if (event.clientY < canvasTop(editor)) return

      const row = rowAtPoint(editor, event.clientY)
      const paragraph = insertParagraphAtRow(editor, row, rows)
      if (!paragraph) return
      event.preventDefault()
      event.stopImmediatePropagation()
      placeCaret(paragraph)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const editor = target.closest<HTMLElement>('.editor-surface')
      if (!editor) return
      const selection = window.getSelection()
      const node = selection?.anchorNode
      const paragraph = node instanceof Element ? node.closest<HTMLParagraphElement>('p') : node?.parentElement?.closest<HTMLParagraphElement>('p')
      if (!paragraph || paragraph.parentElement !== editor) return
      const row = Number.parseInt(paragraph.dataset.oanixLogicalRow ?? '0', 10)
      if (!Number.isSafeInteger(row)) return
      shiftRowsAfter(rows, row, 1)
      writeRows(rows)
      requestAnimationFrame(sync)
    }

    function allowManualViewportScroll(event: Event) {
      event.stopImmediatePropagation()
    }

    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('click', handleClick, true)
    document.addEventListener('keydown', handleKeyDown, true)
    window.visualViewport?.addEventListener('scroll', allowManualViewportScroll, true)
    sync()

    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      window.visualViewport?.removeEventListener('scroll', allowManualViewportScroll, true)
    }
  }, [])

  return null
}
