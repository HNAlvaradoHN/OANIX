import { useLayoutEffect } from 'react'

const ROW_HEIGHT_PX = 32
const ROW_STORAGE_KEY = 'oanix.notebook.rows.v7'

type RowMap = Record<string, number>
type LayoutBlock = HTMLParagraphElement | HTMLElement

type ImageLayoutState = {
  row: number
  span: number
  blocking: boolean
}

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

function blockId(block: LayoutBlock): string {
  const current = block.dataset.blockId
  if (current) return current
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  block.dataset.blockId = id
  return id
}

function createParagraph(): HTMLParagraphElement {
  const paragraph = document.createElement('p')
  paragraph.dataset.blockId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  paragraph.append(document.createElement('br'))
  return paragraph
}

function isImageBlock(block: Element): block is HTMLElement {
  return block instanceof HTMLElement && block.dataset.imageBlock === 'true'
}

function directLayoutBlocks(editor: HTMLElement): LayoutBlock[] {
  return Array.from(editor.children).filter(
    (child): child is LayoutBlock => child instanceof HTMLParagraphElement || isImageBlock(child),
  )
}

function directParagraphs(editor: HTMLElement): HTMLParagraphElement[] {
  return directLayoutBlocks(editor).filter((block): block is HTMLParagraphElement => block instanceof HTMLParagraphElement)
}

function imageAllowsSideFlow(image: HTMLElement): boolean {
  if (image.dataset.imageCompact !== 'true') return false
  return image.dataset.imageAlignment === 'left' || image.dataset.imageAlignment === 'right'
}

function paragraphRows(paragraph: HTMLParagraphElement, rowPx: number): number {
  // A floated image can make the paragraph's layout box much taller than its actual text.
  // Counting scrollHeight therefore made one short line such as "Rios" occupy many logical
  // rows. Measure rendered text-line rects instead, deduplicating inline fragments that share
  // the same baseline. Empty paragraphs still consume exactly one logical row.
  const range = document.createRange()
  range.selectNodeContents(paragraph)
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.height > 0)
  const tops: number[] = []

  for (const rect of rects) {
    const top = rect.top
    if (!tops.some((value) => Math.abs(value - top) < Math.max(2, rowPx * 0.2))) tops.push(top)
  }

  return Math.max(1, tops.length)
}

function imageRows(image: HTMLElement, rowPx: number): number {
  const height = Math.max(image.getBoundingClientRect().height, image.offsetHeight, rowPx)
  return Math.max(1, Math.ceil(height / rowPx))
}

function blockRows(block: LayoutBlock, rowPx: number): number {
  return block instanceof HTMLParagraphElement ? paragraphRows(block, rowPx) : imageRows(block, rowPx)
}

function visualRow(editor: HTMLElement, block: LayoutBlock): number {
  return Math.max(0, Math.round((block.getBoundingClientRect().top - canvasTop(editor)) / rowHeight(editor)))
}

function migrateVisualRows(editor: HTMLElement, rows: RowMap) {
  let changed = false
  for (const block of directLayoutBlocks(editor)) {
    const id = blockId(block)
    if (Number.isSafeInteger(rows[id]) && rows[id] >= 0) continue
    rows[id] = visualRow(editor, block)
    changed = true
  }
  if (changed) writeRows(rows)
}

function shiftRowsAtOrAfter(rows: RowMap, row: number, amount: number, exceptId?: string) {
  if (amount === 0) return
  for (const [id, value] of Object.entries(rows)) {
    if (id === exceptId) continue
    if (Number.isSafeInteger(value) && value >= row) rows[id] = Math.max(0, value + amount)
  }
}

function previousLogicalBottom(editor: HTMLElement, image: HTMLElement, rows: RowMap): number {
  const rowPx = rowHeight(editor)
  const blocks = directLayoutBlocks(editor)
  const index = blocks.indexOf(image)
  if (index <= 0) return 0

  for (let position = index - 1; position >= 0; position -= 1) {
    const previous = blocks[position]
    if (isImageBlock(previous) && imageAllowsSideFlow(previous)) continue
    const id = blockId(previous)
    const row = rows[id]
    if (!Number.isSafeInteger(row)) continue
    return row + blockRows(previous, rowPx)
  }

  return 0
}

function syncImageRows(
  editor: HTMLElement,
  rows: RowMap,
  imageStates: Map<string, ImageLayoutState>,
): boolean {
  const rowPx = rowHeight(editor)
  const images = directLayoutBlocks(editor).filter(isImageBlock)
  const presentIds = new Set(images.map((image) => blockId(image)))
  let changed = false

  for (const image of images) {
    const id = blockId(image)
    const blocking = !imageAllowsSideFlow(image)
    const span = imageRows(image, rowPx)
    const existing = imageStates.get(id)

    if (!existing) {
      const alreadyIntegrated = Number.isSafeInteger(rows[id]) && rows[id] >= 0
      const row = alreadyIntegrated ? rows[id] : previousLogicalBottom(editor, image, rows)
      rows[id] = row
      if (!alreadyIntegrated && blocking) shiftRowsAtOrAfter(rows, row, span, id)
      imageStates.set(id, { row, span, blocking })
      image.dataset.oanixLogicalRow = String(row)
      changed = true
      continue
    }

    const row = rows[id] ?? existing.row
    let delta = 0
    if (existing.blocking && blocking) delta = span - existing.span
    else if (!existing.blocking && blocking) delta = span
    else if (existing.blocking && !blocking) delta = -existing.span

    if (delta !== 0) {
      shiftRowsAtOrAfter(rows, row + 1, delta, id)
      changed = true
    }

    rows[id] = row
    imageStates.set(id, { row, span, blocking })
    image.dataset.oanixLogicalRow = String(row)
  }

  for (const [id, state] of Array.from(imageStates.entries())) {
    if (presentIds.has(id)) continue
    if (state.blocking) shiftRowsAtOrAfter(rows, state.row + 1, -state.span, id)
    delete rows[id]
    imageStates.delete(id)
    changed = true
  }

  return changed
}

function applyLogicalLayout(editor: HTMLElement, rows: RowMap) {
  migrateVisualRows(editor, rows)
  const rowPx = rowHeight(editor)
  let previousBottomRow = 0

  for (const block of directLayoutBlocks(editor)) {
    const id = blockId(block)
    const desiredRow = Math.max(0, rows[id] ?? previousBottomRow)
    block.dataset.oanixLogicalRow = String(desiredRow)

    if (block instanceof HTMLParagraphElement) {
      const gapRows = Math.max(0, desiredRow - previousBottomRow)
      block.dataset.oanixLeadingRows = gapRows > 0 ? String(gapRows) : ''
      if (gapRows > 0) block.style.paddingTop = `${gapRows * rowPx}px`
      else block.style.removeProperty('padding-top')
      previousBottomRow = Math.max(previousBottomRow, desiredRow + paragraphRows(block, rowPx))
      continue
    }

    block.dataset.oanixLeadingRows = ''
    if (!imageAllowsSideFlow(block)) {
      previousBottomRow = Math.max(previousBottomRow, desiredRow + imageRows(block, rowPx))
    }
  }
}

function rowAtPoint(editor: HTMLElement, clientY: number): number {
  return Math.max(0, Math.floor((clientY - canvasTop(editor)) / rowHeight(editor)))
}

function paragraphOccupiesRow(paragraph: HTMLParagraphElement, row: number, rowPx: number): boolean {
  const start = Number.parseInt(paragraph.dataset.oanixLogicalRow ?? '-1', 10)
  if (!Number.isSafeInteger(start) || start < 0) return false
  const length = paragraphRows(paragraph, rowPx)
  return row >= start && row < start + length
}

function blockingImageOccupiesRow(editor: HTMLElement, row: number, rowPx: number): boolean {
  return directLayoutBlocks(editor).some((block) => {
    if (!isImageBlock(block) || imageAllowsSideFlow(block)) return false
    const start = Number.parseInt(block.dataset.oanixLogicalRow ?? '-1', 10)
    if (!Number.isSafeInteger(start) || start < 0) return false
    return row >= start && row < start + imageRows(block, rowPx)
  })
}

function insertParagraphAtRow(editor: HTMLElement, targetRow: number, rows: RowMap): HTMLParagraphElement | null {
  const rowPx = rowHeight(editor)
  const paragraphs = directParagraphs(editor)
  if (paragraphs.some((paragraph) => paragraphOccupiesRow(paragraph, targetRow, rowPx))) return null
  if (blockingImageOccupiesRow(editor, targetRow, rowPx)) return null

  const inserted = createParagraph()
  rows[blockId(inserted)] = targetRow

  const next = directLayoutBlocks(editor).find((block) => {
    const row = Number.parseInt(block.dataset.oanixLogicalRow ?? '0', 10)
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
    const imageStates = new Map<string, ImageLayoutState>()
    let frame = 0
    const sync = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = 0
        document.querySelectorAll<HTMLElement>('.editor-surface').forEach((editor) => {
          const imagesChanged = syncImageRows(editor, rows, imageStates)
          applyLogicalLayout(editor, rows)
          if (imagesChanged) writeRows(rows)
        })
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
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-image-alignment', 'data-image-compact', 'style'],
    })
    document.addEventListener('click', handleClick, true)
    document.addEventListener('keydown', handleKeyDown, true)
    window.visualViewport?.addEventListener('scroll', allowManualViewportScroll, true)
    window.addEventListener('resize', sync)
    sync()

    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      window.visualViewport?.removeEventListener('scroll', allowManualViewportScroll, true)
      window.removeEventListener('resize', sync)
    }
  }, [])

  return null
}
