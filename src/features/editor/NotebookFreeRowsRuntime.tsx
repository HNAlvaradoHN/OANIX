import { useLayoutEffect } from 'react'

const ROW_HEIGHT_PX = 32
const ROW_STORAGE_KEY = 'oanix.notebook.rows.v9'
const EDIT_ROWS = 240
const VIEW_ROWS_AFTER_CONTENT = 14

type RowMap = Record<string, number>
type LayoutBlock = HTMLElement

type ImageState = {
  row: number
  span: number
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
    // Row metadata is a local layout enhancement; note editing must still work without it.
  }
}

function rowHeight(editor: HTMLElement): number {
  const value = Number.parseFloat(getComputedStyle(editor).getPropertyValue('--oanix-notebook-row'))
  return Number.isFinite(value) && value >= 20 ? value : ROW_HEIGHT_PX
}

function editorPaddingLeft(editor: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(editor).paddingLeft) || 0
}

function editorPaddingRight(editor: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(editor).paddingRight) || 0
}

function canvasOffset(editor: HTMLElement): number {
  const directDailyEntries = Array.from(editor.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && child.dataset.dailyEntryBlock === 'true',
  )
  const lastDaily = directDailyEntries.at(-1)
  if (!lastDaily) return Number.parseFloat(getComputedStyle(editor).paddingTop) || 0
  return Math.max(0, lastDaily.offsetTop + lastDaily.offsetHeight)
}

function isDailyEntry(block: Element): boolean {
  return block instanceof HTMLElement && block.dataset.dailyEntryBlock === 'true'
}

function isImageBlock(block: Element): boolean {
  return block instanceof HTMLElement && block.dataset.imageBlock === 'true'
}

function isCanvasBlock(block: Element): block is HTMLElement {
  if (!(block instanceof HTMLElement) || isDailyEntry(block)) return false
  return !!block.dataset.blockId
}

function directCanvasBlocks(editor: HTMLElement): LayoutBlock[] {
  return Array.from(editor.children).filter(isCanvasBlock)
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

function textRows(block: HTMLElement, rowPx: number): number {
  if (isImageBlock(block)) return imageRows(block, rowPx)
  const range = document.createRange()
  range.selectNodeContents(block)
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.height > 0)
  const tops: number[] = []
  for (const rect of rects) {
    if (!tops.some((top) => Math.abs(top - rect.top) < Math.max(2, rowPx * 0.18))) tops.push(rect.top)
  }
  return Math.max(1, tops.length)
}

function imageRows(image: HTMLElement, rowPx: number): number {
  const height = Math.max(image.getBoundingClientRect().height, image.offsetHeight, rowPx)
  return Math.max(1, Math.ceil(height / rowPx))
}

function blockRows(block: LayoutBlock, rowPx: number): number {
  return isImageBlock(block) ? imageRows(block, rowPx) : textRows(block, rowPx)
}

function parseRow(block: HTMLElement): number | null {
  const row = Number.parseInt(block.dataset.oanixLogicalRow ?? '', 10)
  return Number.isSafeInteger(row) && row >= 0 ? row : null
}

function rowOccupied(editor: HTMLElement, row: number, rows: RowMap, ignore?: HTMLElement): boolean {
  const rowPx = rowHeight(editor)
  return directCanvasBlocks(editor).some((block) => {
    if (block === ignore) return false
    const start = rows[blockId(block)] ?? parseRow(block)
    if (!Number.isSafeInteger(start) || start < 0) return false
    return row >= start && row < start + blockRows(block, rowPx)
  })
}

function nextFreeRow(editor: HTMLElement, start: number, rows: RowMap): number {
  let row = Math.max(0, start)
  let guard = 0
  while (rowOccupied(editor, row, rows) && guard < 2000) {
    row += 1
    guard += 1
  }
  return row
}

function shiftRowsAtOrAfter(rows: RowMap, row: number, amount: number, exceptId?: string) {
  if (amount === 0) return
  for (const [id, value] of Object.entries(rows)) {
    if (id === exceptId) continue
    if (Number.isSafeInteger(value) && value >= row) rows[id] = Math.max(0, value + amount)
  }
}

function assignMissingRows(editor: HTMLElement, rows: RowMap): boolean {
  const rowPx = rowHeight(editor)
  let changed = false
  let cursor = 0

  for (const block of directCanvasBlocks(editor)) {
    const id = blockId(block)
    const saved = rows[id]
    if (Number.isSafeInteger(saved) && saved >= 0) {
      cursor = Math.max(cursor, saved + blockRows(block, rowPx))
      continue
    }

    const previous = block.previousElementSibling
    let proposed = cursor
    if (previous instanceof HTMLElement && isCanvasBlock(previous)) {
      const previousRow = rows[blockId(previous)] ?? parseRow(previous) ?? cursor
      proposed = previousRow + blockRows(previous, rowPx)
    }

    if (isImageBlock(block)) {
      const span = imageRows(block, rowPx)
      // A newly inserted image is atomic. Put it immediately after its preceding DOM block and
      // move every later logical block down by the image's complete measured height. This keeps
      // document order intact instead of searching for a distant free row around existing text.
      shiftRowsAtOrAfter(rows, proposed, span, id)
      rows[id] = proposed
      block.dataset.oanixLogicalRow = String(proposed)
      cursor = Math.max(cursor, proposed + span)
      changed = true
      continue
    }

    const row = nextFreeRow(editor, proposed, rows)
    rows[id] = row
    block.dataset.oanixLogicalRow = String(row)
    cursor = Math.max(cursor, row + blockRows(block, rowPx))
    changed = true
  }

  return changed
}

function repairImageBarrier(editor: HTMLElement, image: HTMLElement, rows: RowMap, span: number): boolean {
  const blocks = directCanvasBlocks(editor)
  const imageIndex = blocks.indexOf(image)
  if (imageIndex < 0) return false

  const imageRow = rows[blockId(image)] ?? 0
  const imageEnd = imageRow + span
  const firstOverlappingRow = blocks
    .slice(imageIndex + 1)
    .map((block) => rows[blockId(block)] ?? parseRow(block))
    .filter((row): row is number => Number.isSafeInteger(row) && row >= imageRow && row < imageEnd)
    .sort((left, right) => left - right)[0]

  if (!Number.isSafeInteger(firstOverlappingRow)) return false
  shiftRowsAtOrAfter(rows, firstOverlappingRow, imageEnd - firstOverlappingRow, blockId(image))
  return true
}

function syncImageReservations(
  editor: HTMLElement,
  rows: RowMap,
  states: Map<string, ImageState>,
): boolean {
  const rowPx = rowHeight(editor)
  const images = directCanvasBlocks(editor).filter((block) => isImageBlock(block))
  const present = new Set(images.map((image) => blockId(image)))
  let changed = false

  for (const image of images) {
    const id = blockId(image)
    const row = rows[id] ?? 0
    const span = imageRows(image, rowPx)
    const previous = states.get(id)

    if (!previous) {
      // assignMissingRows already reserves new images. For notes created before this atomic model,
      // repair only an actual overlap inside the measured image range instead of blindly shifting
      // every following row a second time.
      if (repairImageBarrier(editor, image, rows, span)) changed = true
      states.set(id, { row, span })
      continue
    }

    const delta = span - previous.span
    if (delta !== 0) {
      // Grow or shrink only the rows that begin after the image's previous reserved range.
      // ResizeObserver calls this again when the real image, controls, or description change height.
      shiftRowsAtOrAfter(rows, row + previous.span, delta, id)
      changed = true
    }
    states.set(id, { row, span })
  }

  for (const [id, state] of Array.from(states.entries())) {
    if (present.has(id)) continue
    // Image removal is authorized elsewhere. Collapse exactly the space that belonged to it and
    // leave text deletion unable to consume or partially overlap any surviving image block.
    shiftRowsAtOrAfter(rows, state.row + state.span, -state.span, id)
    delete rows[id]
    states.delete(id)
    changed = true
  }

  return changed
}

function repairBlockOrderOverlaps(editor: HTMLElement, rows: RowMap): boolean {
  const rowPx = rowHeight(editor)
  let nextAvailableRow = 0
  let changed = false

  for (const block of directCanvasBlocks(editor)) {
    const id = blockId(block)
    const savedRow = rows[id] ?? parseRow(block) ?? nextAvailableRow
    const row = Math.max(savedRow, nextAvailableRow)

    if (row !== savedRow) {
      rows[id] = row
      block.dataset.oanixLogicalRow = String(row)
      changed = true
    }

    nextAvailableRow = row + blockRows(block, rowPx)
  }

  return changed
}

function positionBlock(editor: HTMLElement, block: HTMLElement, row: number) {
  const rowPx = rowHeight(editor)
  const top = canvasOffset(editor) + row * rowPx
  block.dataset.oanixLogicalRow = String(row)
  block.dataset.oanixVirtualBlock = 'true'
  block.style.position = 'absolute'
  block.style.top = `${top}px`
  block.style.marginTop = '0'
  block.style.marginBottom = '0'

  const padLeft = editorPaddingLeft(editor)
  const padRight = editorPaddingRight(editor)

  block.style.transform = 'none'
  block.style.left = `${padLeft}px`
  block.style.right = `${padRight}px`
  block.style.width = 'auto'
  block.style.maxWidth = 'none'
}

function maxUsedRow(editor: HTMLElement, rows: RowMap): number {
  const rowPx = rowHeight(editor)
  let max = 0
  for (const block of directCanvasBlocks(editor)) {
    const row = rows[blockId(block)] ?? 0
    max = Math.max(max, row + blockRows(block, rowPx))
  }
  return max
}

function applyVirtualCanvas(editor: HTMLElement, rows: RowMap) {
  const offset = canvasOffset(editor)
  for (const block of directCanvasBlocks(editor)) {
    const row = rows[blockId(block)] ?? 0
    positionBlock(editor, block, row)
  }

  const focused = editor === document.activeElement || editor.contains(document.activeElement)
  const used = maxUsedRow(editor, rows)
  const virtualRows = focused ? Math.max(EDIT_ROWS, used + 80) : Math.max(used + VIEW_ROWS_AFTER_CONTENT, 18)
  editor.dataset.oanixVirtualCanvas = 'true'
  editor.style.minHeight = `${Math.ceil(offset + virtualRows * rowHeight(editor))}px`
}

function rowAtPoint(editor: HTMLElement, clientY: number): number {
  const rect = editor.getBoundingClientRect()
  const localY = clientY - rect.top - canvasOffset(editor)
  return Math.max(0, Math.floor(localY / rowHeight(editor)))
}

function paragraphOccupiesRow(editor: HTMLElement, row: number, rows: RowMap): boolean {
  const rowPx = rowHeight(editor)
  return directCanvasBlocks(editor).some((block) => {
    if (isImageBlock(block)) return false
    const start = rows[blockId(block)] ?? 0
    return row >= start && row < start + blockRows(block, rowPx)
  })
}

function imageOccupiesRow(editor: HTMLElement, row: number, rows: RowMap): boolean {
  const rowPx = rowHeight(editor)
  return directCanvasBlocks(editor).some((block) => {
    if (!isImageBlock(block)) return false
    const start = rows[blockId(block)] ?? 0
    return row >= start && row < start + imageRows(block, rowPx)
  })
}

function insertParagraphAtRow(editor: HTMLElement, targetRow: number, rows: RowMap): HTMLParagraphElement | null {
  if (paragraphOccupiesRow(editor, targetRow, rows)) return null
  if (imageOccupiesRow(editor, targetRow, rows)) return null

  const inserted = createParagraph()
  rows[blockId(inserted)] = targetRow
  const next = directCanvasBlocks(editor).find((block) => (rows[blockId(block)] ?? 0) > targetRow)
  if (next) next.before(inserted)
  else editor.append(inserted)

  writeRows(rows)
  applyVirtualCanvas(editor, rows)
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
    const imageStates = new Map<string, ImageState>()
    const observedImages = new Set<HTMLElement>()
    let frame = 0

    const sync = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = 0
        document.querySelectorAll<HTMLElement>('.editor-surface').forEach((editor) => {
          const assigned = assignMissingRows(editor, rows)
          const imagesChanged = syncImageReservations(editor, rows, imageStates)
          const overlapsRepaired = repairBlockOrderOverlaps(editor, rows)
          applyVirtualCanvas(editor, rows)
          if (assigned || imagesChanged || overlapsRepaired) writeRows(rows)

          editor.querySelectorAll<HTMLElement>(':scope > [data-image-block="true"]').forEach((image) => {
            if (observedImages.has(image)) return
            observedImages.add(image)
            imageResizeObserver.observe(image)
          })
        })

        for (const image of Array.from(observedImages)) {
          if (image.isConnected) continue
          imageResizeObserver.unobserve(image)
          observedImages.delete(image)
        }
      })
    }

    const imageResizeObserver = new ResizeObserver(sync)

    function handleClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      const editor = target.closest<HTMLElement>('.editor-surface')
      if (!editor || blockedTarget(target, editor)) return

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

      const row = rows[blockId(paragraph)] ?? parseRow(paragraph) ?? 0
      const nextRow = row + 1

      // The browser's native contenteditable Enter creates a DOM paragraph before the virtual
      // row map can assign it, which made the new line render on top of the current one. Own the
      // operation here: reserve one logical row, create exactly one paragraph there, then focus it.
      event.preventDefault()
      event.stopImmediatePropagation()
      shiftRowsAfter(rows, row, 1)

      const inserted = createParagraph()
      rows[blockId(inserted)] = nextRow
      const following = directCanvasBlocks(editor).find((block) => block !== paragraph && (rows[blockId(block)] ?? 0) > row)
      if (following) following.before(inserted)
      else paragraph.after(inserted)

      writeRows(rows)
      applyVirtualCanvas(editor, rows)
      placeCaret(inserted)
    }

    function keepManualScroll(event: Event) {
      event.stopImmediatePropagation()
    }

    const observer = new MutationObserver(sync)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-image-info-open'],
    })
    document.addEventListener('click', handleClick, true)
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('focusin', sync, true)
    document.addEventListener('focusout', sync, true)
    window.visualViewport?.addEventListener('scroll', keepManualScroll, true)
    window.addEventListener('resize', sync)
    sync()

    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      imageResizeObserver.disconnect()
      observedImages.clear()
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('focusin', sync, true)
      document.removeEventListener('focusout', sync, true)
      window.visualViewport?.removeEventListener('scroll', keepManualScroll, true)
      window.removeEventListener('resize', sync)
    }
  }, [])

  return null
}
