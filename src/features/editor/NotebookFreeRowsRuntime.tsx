import { useLayoutEffect } from 'react'

const ROW_HEIGHT_PX = 32
const ROW_STORAGE_KEY = 'oanix.notebook.rows.v9'
const EDIT_ROWS = 240
const VIEW_ROWS_AFTER_CONTENT = 14
const RESERVED_INSERT_SELECTOR =
  '[data-image-tool="true"], [data-format="code"], [data-insert="checklist"], [data-insert="contact"]'

type RowMap = Record<string, number>
type LayoutBlock = HTMLElement

type ReservedBlockState = {
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

function isReservedBlock(block: Element): boolean {
  return (
    block instanceof HTMLElement &&
    (block.dataset.imageBlock === 'true' ||
      block.dataset.codeBlock === 'true' ||
      block.dataset.checklistBlock === 'true' ||
      block.dataset.contactBlock === 'true')
  )
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

function reservedBlockRows(block: HTMLElement, rowPx: number): number {
  const height = Math.max(block.getBoundingClientRect().height, block.offsetHeight, rowPx)
  return Math.max(1, Math.ceil(height / rowPx))
}

function textRows(block: HTMLElement, rowPx: number): number {
  const range = document.createRange()
  range.selectNodeContents(block)
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.height > 0)
  const tops: number[] = []
  for (const rect of rects) {
    if (!tops.some((top) => Math.abs(top - rect.top) < Math.max(2, rowPx * 0.18))) tops.push(rect.top)
  }
  return Math.max(1, tops.length)
}

function blockRows(block: LayoutBlock, rowPx: number): number {
  return isReservedBlock(block) ? reservedBlockRows(block, rowPx) : textRows(block, rowPx)
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

function reservedBlockOwnsClientY(editor: HTMLElement, clientY: number): boolean {
  return directCanvasBlocks(editor).some((block) => {
    if (!isReservedBlock(block)) return false
    const rect = block.getBoundingClientRect()
    return rect.height > 0 && clientY >= rect.top && clientY < rect.bottom
  })
}

function reservedBlockOccupiesRow(editor: HTMLElement, row: number, rows: RowMap): boolean {
  const rowPx = rowHeight(editor)
  return directCanvasBlocks(editor).some((block) => {
    if (!isReservedBlock(block)) return false
    const start = rows[blockId(block)] ?? parseRow(block)
    if (!Number.isSafeInteger(start) || start < 0) return false
    return row >= start && row < start + reservedBlockRows(block, rowPx)
  })
}

function rowTouchesReservedBoundary(editor: HTMLElement, row: number, rows: RowMap): boolean {
  const rowPx = rowHeight(editor)
  return directCanvasBlocks(editor).some((block) => {
    if (!isReservedBlock(block)) return false
    const start = rows[blockId(block)] ?? parseRow(block)
    if (!Number.isSafeInteger(start) || start < 0) return false
    const end = start + reservedBlockRows(block, rowPx)
    return (start > 0 && row === start - 1) || row === end
  })
}

function isEmptyInsertionParagraph(block: Element | null): block is HTMLParagraphElement {
  return (
    block instanceof HTMLParagraphElement &&
    isCanvasBlock(block) &&
    (block.textContent ?? '').trim() === ''
  )
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

function selectionDirectBlock(editor: HTMLElement): HTMLElement | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  let element: Element | null =
    selection.anchorNode instanceof Element
      ? selection.anchorNode
      : selection.anchorNode?.parentElement ?? null

  while (element && element.parentElement !== editor) element = element.parentElement
  return element instanceof HTMLElement && isCanvasBlock(element) ? element : null
}

function placePendingReservedAfterAnchor(
  editor: HTMLElement,
  rows: RowMap,
  pendingAnchorIds: WeakMap<HTMLElement, string>,
): boolean {
  const anchorId = pendingAnchorIds.get(editor)
  if (!anchorId) return false

  const blocks = directCanvasBlocks(editor)
  const anchor = blocks.find((block) => blockId(block) === anchorId)
  const pending = blocks.filter((block) => {
    if (!isReservedBlock(block)) return false
    const id = blockId(block)
    return !Number.isSafeInteger(rows[id]) && parseRow(block) === null
  })

  if (!anchor || pending.length === 0) return false

  let reference = anchor
  let changed = false
  for (const block of pending) {
    if (reference.nextElementSibling !== block) {
      reference.after(block)
      changed = true
    }
    reference = block
  }

  pendingAnchorIds.delete(editor)
  return changed
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

    if (isReservedBlock(block)) {
      const span = reservedBlockRows(block, rowPx)
      let insertionRow = proposed
      let replacedRows = 0

      // An empty paragraph created by Enter or by the immediate border tap is a caret placeholder.
      // The special card consumes that exact row and reserves the remaining measured height below it.
      if (isEmptyInsertionParagraph(previous)) {
        const previousId = blockId(previous)
        const previousRow = rows[previousId] ?? parseRow(previous)
        if (Number.isSafeInteger(previousRow) && previousRow >= 0) {
          insertionRow = previousRow
          replacedRows = blockRows(previous, rowPx)
          delete rows[previousId]
          previous.remove()
          editor.dataset.oanixConsumedInsertionParagraph = 'true'
          changed = true
        }
      }

      const extraRows = Math.max(0, span - replacedRows)
      shiftRowsAtOrAfter(rows, insertionRow + replacedRows, extraRows, id)
      rows[id] = insertionRow
      block.dataset.oanixLogicalRow = String(insertionRow)
      cursor = Math.max(cursor, insertionRow + span)
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

function repairReservedBarrier(editor: HTMLElement, reserved: HTMLElement, rows: RowMap, span: number): boolean {
  const blocks = directCanvasBlocks(editor)
  const reservedIndex = blocks.indexOf(reserved)
  if (reservedIndex < 0) return false

  const reservedRow = rows[blockId(reserved)] ?? 0
  const reservedEnd = reservedRow + span
  const firstOverlappingRow = blocks
    .slice(reservedIndex + 1)
    .map((block) => rows[blockId(block)] ?? parseRow(block))
    .filter((row): row is number => Number.isSafeInteger(row) && row >= reservedRow && row < reservedEnd)
    .sort((left, right) => left - right)[0]

  if (!Number.isSafeInteger(firstOverlappingRow)) return false
  shiftRowsAtOrAfter(rows, firstOverlappingRow, reservedEnd - firstOverlappingRow, blockId(reserved))
  return true
}

function syncReservedBlockReservations(
  editor: HTMLElement,
  rows: RowMap,
  states: Map<string, ReservedBlockState>,
): boolean {
  const rowPx = rowHeight(editor)
  const reservedBlocks = directCanvasBlocks(editor).filter(isReservedBlock)
  const present = new Set(reservedBlocks.map((block) => blockId(block)))
  let changed = false

  for (const reserved of reservedBlocks) {
    const id = blockId(reserved)
    const row = rows[id] ?? 0
    const span = reservedBlockRows(reserved, rowPx)
    const previous = states.get(id)

    if (!previous) {
      if (repairReservedBarrier(editor, reserved, rows, span)) changed = true
      states.set(id, { row, span })
      continue
    }

    const delta = span - previous.span
    if (delta !== 0) {
      shiftRowsAtOrAfter(rows, row + previous.span, delta, id)
      changed = true
    }
    states.set(id, { row, span })
  }

  for (const [id, state] of Array.from(states.entries())) {
    if (present.has(id)) continue
    // Sequential-editor mode has no arbitrary free-row cursor. Collapse the exact vacated span so
    // deleting an atomic card behaves like deleting content in a normal text editor.
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

function refreshReservedStateRows(rows: RowMap, states: Map<string, ReservedBlockState>) {
  for (const [id, state] of states.entries()) {
    const row = rows[id]
    if (Number.isSafeInteger(row) && row >= 0 && row !== state.row) {
      states.set(id, { row, span: state.span })
    }
  }
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

function insertParagraphAtRow(editor: HTMLElement, targetRow: number, rows: RowMap): HTMLParagraphElement | null {
  if (rowOccupied(editor, targetRow, rows)) return null

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
    const reservedStates = new Map<string, ReservedBlockState>()
    const observedReservedBlocks = new Set<HTMLElement>()
    const pendingAnchorIds = new WeakMap<HTMLElement, string>()
    let frame = 0

    const sync = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = 0
        document.querySelectorAll<HTMLElement>('.editor-surface').forEach((editor) => {
          const pendingPlaced = placePendingReservedAfterAnchor(editor, rows, pendingAnchorIds)
          const assigned = assignMissingRows(editor, rows)
          const reservedChanged = syncReservedBlockReservations(editor, rows, reservedStates)
          const overlapsRepaired = repairBlockOrderOverlaps(editor, rows)
          refreshReservedStateRows(rows, reservedStates)
          applyVirtualCanvas(editor, rows)
          if (pendingPlaced || assigned || reservedChanged || overlapsRepaired) writeRows(rows)

          if (editor.dataset.oanixConsumedInsertionParagraph === 'true') {
            delete editor.dataset.oanixConsumedInsertionParagraph
            queueMicrotask(() => {
              if (editor.isConnected) editor.dispatchEvent(new Event('input', { bubbles: true }))
            })
          }

          directCanvasBlocks(editor)
            .filter(isReservedBlock)
            .forEach((block) => {
              if (observedReservedBlocks.has(block)) return
              observedReservedBlocks.add(block)
              reservedResizeObserver.observe(block)
            })
        })

        for (const block of Array.from(observedReservedBlocks)) {
          if (block.isConnected) continue
          reservedResizeObserver.unobserve(block)
          observedReservedBlocks.delete(block)
        }
      })
    }

    const reservedResizeObserver = new ResizeObserver(sync)

    function captureReservedInsertionAnchor(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element) || !target.closest(RESERVED_INSERT_SELECTOR)) return
      const root = target.closest<HTMLElement>('.image-note-editor-root')
      const editor = root?.querySelector<HTMLElement>('.editor-surface') ?? null
      const anchor = editor ? selectionDirectBlock(editor) : null
      if (editor && anchor) pendingAnchorIds.set(editor, blockId(anchor))
    }

    function handleClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      const editor = target.closest<HTMLElement>('.editor-surface')
      if (!editor || blockedTarget(target, editor)) return

      // Existing text paragraphs keep normal browser caret behavior. Empty background is no longer a
      // free-placement canvas: only the row immediately above or below an atomic card may create a
      // new caret paragraph. This prevents arbitrary row activation from competing with reservations.
      if (reservedBlockOwnsClientY(editor, event.clientY)) {
        event.preventDefault()
        event.stopImmediatePropagation()
        return
      }

      const row = rowAtPoint(editor, event.clientY)
      if (reservedBlockOccupiesRow(editor, row, rows)) {
        event.preventDefault()
        event.stopImmediatePropagation()
        return
      }

      if (rowOccupied(editor, row, rows)) return

      if (!rowTouchesReservedBoundary(editor, row, rows)) {
        event.preventDefault()
        event.stopImmediatePropagation()
        return
      }

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
    document.addEventListener('click', captureReservedInsertionAnchor, true)
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
      reservedResizeObserver.disconnect()
      observedReservedBlocks.clear()
      document.removeEventListener('click', captureReservedInsertionAnchor, true)
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
