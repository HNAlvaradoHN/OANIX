import { useEffect, useMemo, useRef } from 'react'
import type { EditorSurfaceBlock, EditorSurfaceBlockChangeSet } from '../editorSurfaceContract.ts'
import { findOanixClipboardImage } from '../oanixClipboardImage.ts'
import {
  registerOanixTextLineFlusher,
  useOanixTextLineRuntime,
} from '../oanixTextLineRuntime.tsx'
import {
  decodeTextBlock,
  encodeTextBlock,
  type EditorTextBlock,
  type EditorTextBlockFormat,
} from '../textBlockCodec.ts'
import './oanixTextLineEditor.css'

interface OanixTextLineEditorProps {
  blocks: readonly EditorSurfaceBlock[]
  disabled: boolean
  onTextCursorChange?: (blockId: string, cursorOffset: number) => void
  onPasteImage?: (file: File, blockId: string, cursorOffset: number) => void | Promise<void>
  onActivity: () => void
  onCompositionStart: () => void
  onCompositionEnd: () => void
  onError?: (message: string) => void
}

type LineData = EditorTextBlock

type CurrentContext = {
  lineEl: HTMLDivElement | null
  line: LineData | null
  offset: number
  selectionStart: number
  selectionEnd: number
  hasSelection: boolean
  selectedText: string
}

type StoredSelection = {
  blockId: string
  selectionStart: number
  selectionEnd: number
}

const TEXT_FORMATS = new Set<EditorTextBlockFormat>([
  'paragraph',
  'h2',
  'h3',
  'quote',
  'list',
  'numbered-list',
])
const ATOMIC_TEXT_FORMATS = new Set<EditorTextBlockFormat>([
  'quote',
  'list',
  'numbered-list',
])
const TEXT_SAVE_IDLE_MS = 3_000
const LINE_SELECTOR = '.oanix-text-line-editor__line'

/**
 * A note may render several text-line editors separated by atomic blocks.
 * Only the editor that most recently owned a live selection may handle the
 * shared OANIX format/history controls.
 */
const activeTextLineEditorByNote = new Map<string, symbol>()

function createTextLineId() {
  return `oanix-text-${crypto.randomUUID()}`
}

function cloneLines(source: readonly LineData[]) {
  return source.map((line) => ({ ...line }))
}

function decodeLines(blocks: readonly EditorSurfaceBlock[]) {
  return blocks
    .map((block) => decodeTextBlock(block))
    .filter((block): block is LineData => Boolean(block))
}

function lineSignature(source: readonly LineData[]) {
  return source
    .map((line) => [line.id, line.format ?? 'paragraph', line.text].join('\u0000'))
    .join('\u0001')
}

function isAtomicTextFormat(format: EditorTextBlockFormat | undefined) {
  return Boolean(format && ATOMIC_TEXT_FORMATS.has(format))
}

function isEmptyParagraph(line: LineData | undefined) {
  return Boolean(line && (line.format ?? 'paragraph') === 'paragraph' && line.text.trim().length === 0)
}

function createEmptyParagraph(kind: LineData['kind']): LineData {
  return {
    id: createTextLineId(),
    kind,
    text: '',
    format: 'paragraph',
  }
}

function withAtomicParagraphBoundaries(source: readonly LineData[]) {
  const lines: LineData[] = []
  const added: LineData[] = []

  source.forEach((line, index) => {
    if (!isAtomicTextFormat(line.format)) {
      lines.push({ ...line })
      return
    }

    if (!isEmptyParagraph(lines.at(-1))) {
      const before = createEmptyParagraph(line.kind)
      lines.push(before)
      added.push(before)
    }

    lines.push({ ...line })

    if (!isEmptyParagraph(source[index + 1])) {
      const after = createEmptyParagraph(line.kind)
      lines.push(after)
      added.push(after)
    }
  })

  return { lines, added }
}

function headingToParagraphIfEmpty(line: LineData): LineData {
  if (line.text.trim().length > 0) return line
  if (line.format !== 'h2' && line.format !== 'h3') return line
  return { ...line, format: 'paragraph' }
}

function emptyContext(): CurrentContext {
  return {
    lineEl: null,
    line: null,
    offset: 0,
    selectionStart: 0,
    selectionEnd: 0,
    hasSelection: false,
    selectedText: '',
  }
}

export function OanixTextLineEditor({
  blocks,
  disabled,
  onTextCursorChange,
  onPasteImage,
  onActivity,
  onCompositionStart,
  onCompositionEnd,
  onError,
}: OanixTextLineEditorProps) {
  const runtime = useOanixTextLineRuntime()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const lineRefs = useRef(new Map<string, HTMLDivElement>())
  const linesRef = useRef<LineData[]>([])
  const dirtyBlocksRef = useRef(new Map<string, EditorSurfaceBlock>())
  const saveTimerRef = useRef<number | null>(null)
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true))
  const composingRef = useRef(false)
  const undoStackRef = useRef<LineData[][]>([])
  const redoStackRef = useRef<LineData[][]>([])
  const lastSelectionRef = useRef<StoredSelection | null>(null)
  const disabledRef = useRef(disabled)
  const runtimeRef = useRef(runtime)
  const editorTokenRef = useRef(Symbol('oanix-text-line-editor'))
  const callbacksRef = useRef({
    onTextCursorChange,
    onPasteImage,
    onActivity,
    onCompositionStart,
    onCompositionEnd,
    onError,
  })

  runtimeRef.current = runtime
  callbacksRef.current = {
    onTextCursorChange,
    onPasteImage,
    onActivity,
    onCompositionStart,
    onCompositionEnd,
    onError,
  }

  const decodedExternal = useMemo(() => decodeLines(blocks), [blocks])
  const externalSignature = useMemo(() => lineSignature(decodedExternal), [decodedExternal])
  const initialLinesRef = useRef(decodedExternal)
  initialLinesRef.current = decodedExternal
  const lastExternalSignatureRef = useRef(externalSignature)

  function activateInteractionTarget() {
    const noteId = runtimeRef.current?.noteId
    if (!noteId) return
    activeTextLineEditorByNote.set(noteId, editorTokenRef.current)
  }

  function isActiveInteractionTarget() {
    const noteId = runtimeRef.current?.noteId
    return Boolean(noteId && activeTextLineEditorByNote.get(noteId) === editorTokenRef.current)
  }

  function getLine(id: string) {
    return linesRef.current.find((line) => line.id === id) ?? null
  }

  function getLineEl(id: string) {
    return lineRefs.current.get(id) ?? null
  }

  function saveState() {
    undoStackRef.current.push(cloneLines(linesRef.current))
    if (undoStackRef.current.length > 100) undoStackRef.current.shift()
    redoStackRef.current = []
  }

  function offsetInsideLine(lineEl: HTMLDivElement, node: Node, offset: number) {
    try {
      const range = document.createRange()
      range.setStart(lineEl, 0)
      range.setEnd(node, offset)
      return range.toString().length
    } catch {
      return Math.max(0, offset)
    }
  }

  function readLiveContext(): CurrentContext {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return emptyContext()

    const range = selection.getRangeAt(0)
    const anchor = range.startContainer
    const candidate = anchor.nodeType === Node.TEXT_NODE
      ? anchor.parentElement?.closest<HTMLDivElement>(LINE_SELECTOR) ?? null
      : anchor instanceof Element
        ? anchor.closest<HTMLDivElement>(LINE_SELECTOR)
        : null
    const lineEl = candidate && containerRef.current?.contains(candidate) ? candidate : null
    if (!lineEl) return emptyContext()

    const id = lineEl.dataset.oanixMixedTextId
    const line = id ? getLine(id) : null
    if (!line || isAtomicTextFormat(line.format)) return emptyContext()

    const selectionStart = offsetInsideLine(lineEl, range.startContainer, range.startOffset)
    let selectionEnd = selectionStart
    const endCandidate = range.endContainer.nodeType === Node.TEXT_NODE
      ? range.endContainer.parentElement?.closest<HTMLDivElement>(LINE_SELECTOR) ?? null
      : range.endContainer instanceof Element
        ? range.endContainer.closest<HTMLDivElement>(LINE_SELECTOR)
        : null
    if (endCandidate === lineEl) {
      selectionEnd = offsetInsideLine(lineEl, range.endContainer, range.endOffset)
    } else if (!selection.isCollapsed) {
      selectionEnd = lineEl.textContent.length
    }

    const start = Math.min(selectionStart, selectionEnd)
    const end = Math.max(selectionStart, selectionEnd)
    lastSelectionRef.current = {
      blockId: line.id,
      selectionStart: start,
      selectionEnd: end,
    }
    activateInteractionTarget()

    return {
      lineEl,
      line,
      offset: start,
      selectionStart: start,
      selectionEnd: end,
      hasSelection: end > start,
      selectedText: end > start ? lineEl.textContent.slice(start, end) : '',
    }
  }

  function getCurrentContext(): CurrentContext {
    const live = readLiveContext()
    if (live.line) return live

    const stored = lastSelectionRef.current
    if (!stored) return emptyContext()
    const line = getLine(stored.blockId)
    const lineEl = getLineEl(stored.blockId)
    if (!line || !lineEl || isAtomicTextFormat(line.format) || !lineEl.matches(LINE_SELECTOR)) return emptyContext()

    const text = lineEl.textContent
    const start = Math.min(Math.max(0, stored.selectionStart), text.length)
    const end = Math.min(Math.max(start, stored.selectionEnd), text.length)
    return {
      lineEl,
      line,
      offset: start,
      selectionStart: start,
      selectionEnd: end,
      hasSelection: end > start,
      selectedText: text.slice(start, end),
    }
  }

  function resolveTextPoint(el: HTMLDivElement, offset: number): { node: Node; offset: number } {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let remaining = Math.max(0, offset)
    let node = walker.nextNode()

    while (node) {
      const length = node.textContent?.length ?? 0
      if (remaining <= length) return { node, offset: remaining }
      remaining -= length
      node = walker.nextNode()
    }

    return { node: el, offset: el.childNodes.length }
  }

  function placeSelection(el: HTMLDivElement, start: number, end = start) {
    const textLength = el.textContent.length
    const safeStart = Math.min(Math.max(0, start), textLength)
    const safeEnd = Math.min(Math.max(safeStart, end), textLength)
    const startPoint = resolveTextPoint(el, safeStart)
    const endPoint = resolveTextPoint(el, safeEnd)
    const range = document.createRange()
    range.setStart(startPoint.node, startPoint.offset)
    range.setEnd(endPoint.node, endPoint.offset)

    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    const blockId = el.dataset.oanixMixedTextId
    if (blockId) {
      lastSelectionRef.current = {
        blockId,
        selectionStart: safeStart,
        selectionEnd: safeEnd,
      }
    }
  }

  function focusLine(lineId: string, start?: number, end?: number) {
    const el = getLineEl(lineId)
    if (!el || !el.matches(LINE_SELECTOR)) return

    el.focus()
    const textLength = el.textContent.length
    const at = typeof start === 'number' ? start : textLength
    placeSelection(el, at, typeof end === 'number' ? end : at)
    activateInteractionTarget()
    el.scrollIntoView({ block: 'nearest' })

    const ctx = readLiveContext()
    if (ctx.line) callbacksRef.current.onTextCursorChange?.(ctx.line.id, ctx.offset)
  }

  function clearStoredTextTarget() {
    lastSelectionRef.current = null
    activateInteractionTarget()
    window.getSelection()?.removeAllRanges()
    apiRef.current.updateToolbar()
  }

  function commitAtomicText(lineId: string, text: string) {
    const line = getLine(lineId)
    if (!line || !isAtomicTextFormat(line.format)) return
    const next = { ...line, text }
    linesRef.current = linesRef.current.map((item) => (item.id === lineId ? next : item))
    callbacksRef.current.onActivity()
    scheduleTextSave(encodeTextBlock(next))
  }

  function focusAtomicLine(lineId: string, itemIndex = 0) {
    const root = getLineEl(lineId)
    if (!root || !isAtomicTextFormat(getLine(lineId)?.format)) return
    clearStoredTextTarget()
    const controls = root.querySelectorAll<HTMLElement>('.oanix-text-atomic__input')
    controls[Math.min(Math.max(0, itemIndex), Math.max(0, controls.length - 1))]?.focus()
    root.scrollIntoView({ block: 'nearest' })
  }

  function buildAtomicLineEl(line: LineData): HTMLDivElement {
    const format = line.format
    const root = document.createElement('div')
    root.className = `oanix-text-atomic oanix-text-atomic--${format}`
    root.dataset.oanixMixedTextId = line.id
    root.dataset.oanixTextFormat = format
    root.dataset.oanixElementId = line.id
    root.dataset.oanixElementKind = format

    const header = document.createElement('div')
    header.className = 'oanix-text-atomic__header'
    const title = document.createElement('strong')
    title.textContent = format === 'quote' ? 'Cita' : format === 'list' ? 'Lista' : 'Lista numérica'
    header.appendChild(title)

    const deleteBlock = document.createElement('button')
    deleteBlock.type = 'button'
    deleteBlock.className = 'oanix-text-atomic__delete-block'
    deleteBlock.textContent = 'Eliminar bloque'
    deleteBlock.disabled = disabledRef.current
    deleteBlock.setAttribute('aria-label', `Eliminar bloque ${title.textContent}`)
    deleteBlock.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      removeAtomicBlock(line.id)
    })
    header.appendChild(deleteBlock)
    root.appendChild(header)

    const handleAtomicFocus = () => clearStoredTextTarget()

    if (format === 'quote') {
      const textarea = document.createElement('textarea')
      textarea.className = 'oanix-text-atomic__input oanix-text-atomic__quote'
      textarea.value = line.text
      textarea.rows = 1
      textarea.maxLength = 200_000
      textarea.placeholder = 'Escribe una cita…'
      textarea.setAttribute('aria-label', 'Cita')
      textarea.disabled = disabledRef.current

      const resize = () => {
        textarea.style.height = 'auto'
        textarea.style.height = `${Math.max(42, textarea.scrollHeight)}px`
      }
      textarea.addEventListener('focus', handleAtomicFocus)
      textarea.addEventListener('input', () => {
        resize()
        commitAtomicText(line.id, textarea.value)
      })
      textarea.addEventListener('compositionstart', () => {
        composingRef.current = true
        callbacksRef.current.onCompositionStart()
      })
      textarea.addEventListener('compositionend', () => {
        composingRef.current = false
        callbacksRef.current.onCompositionEnd()
        commitAtomicText(line.id, textarea.value)
      })
      root.appendChild(textarea)
      queueMicrotask(resize)
    } else {
      const items = line.text.length > 0 ? line.text.split('\n') : ['']
      const itemsRoot = document.createElement('div')
      itemsRoot.className = 'oanix-text-atomic__items'
      root.appendChild(itemsRoot)

      const commitItems = () => commitAtomicText(line.id, items.join('\n'))

      const renderItems = (focusIndex?: number) => {
        itemsRoot.replaceChildren()
        items.forEach((text, index) => {
          const row = document.createElement('div')
          row.className = 'oanix-text-atomic__row'

          const marker = document.createElement('span')
          marker.className = 'oanix-text-atomic__marker'
          marker.textContent = format === 'list' ? '•' : `${index + 1}.`
          row.appendChild(marker)

          const input = document.createElement('input')
          input.className = 'oanix-text-atomic__input oanix-text-atomic__item'
          input.type = 'text'
          input.value = text
          input.maxLength = 2_000
          input.placeholder = 'Escribe un elemento…'
          input.disabled = disabledRef.current
          input.setAttribute('aria-label', `${format === 'list' ? 'Elemento' : 'Elemento numerado'} ${index + 1}`)
          input.addEventListener('focus', handleAtomicFocus)
          input.addEventListener('input', () => {
            items[index] = input.value
            commitItems()
          })
          input.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' || event.shiftKey) return
            event.preventDefault()
            if (items.length >= 200) return
            items.splice(index + 1, 0, '')
            commitItems()
            renderItems(index + 1)
            saveState()
          })
          row.appendChild(input)

          const remove = document.createElement('button')
          remove.type = 'button'
          remove.className = 'oanix-text-atomic__remove'
          remove.textContent = '×'
          remove.disabled = disabledRef.current
          remove.setAttribute('aria-label', `Quitar elemento ${index + 1}`)
          remove.addEventListener('click', () => {
            if (disabledRef.current) return
            items.splice(index, 1)
            if (items.length === 0) items.push('')
            commitItems()
            renderItems(Math.min(index, items.length - 1))
            saveState()
          })
          row.appendChild(remove)
          itemsRoot.appendChild(row)
        })

        if (typeof focusIndex === 'number') {
          const inputs = itemsRoot.querySelectorAll<HTMLInputElement>('.oanix-text-atomic__item')
          inputs[Math.min(Math.max(0, focusIndex), Math.max(0, inputs.length - 1))]?.focus()
        }
      }

      renderItems()

      const footer = document.createElement('div')
      footer.className = 'oanix-text-atomic__footer'
      const add = document.createElement('button')
      add.type = 'button'
      add.className = 'oanix-text-atomic__add'
      add.textContent = format === 'list' ? '＋ Añadir elemento' : '＋ Añadir número'
      add.disabled = disabledRef.current || items.length >= 200
      add.addEventListener('click', () => {
        if (disabledRef.current || items.length >= 200) return
        items.push('')
        commitItems()
        renderItems(items.length - 1)
        add.disabled = items.length >= 200
        saveState()
      })
      footer.appendChild(add)
      root.appendChild(footer)
    }

    lineRefs.current.set(line.id, root)
    return root
  }

  function buildLineEl(line: LineData): HTMLDivElement {
    if (isAtomicTextFormat(line.format)) return buildAtomicLineEl(line)

    const el = document.createElement('div')
    el.className = 'oanix-mixed-document__text oanix-text-line-editor__line'
    el.dataset.oanixMixedTextId = line.id
    el.dataset.oanixTextFormat = line.format ?? 'paragraph'
    el.dataset.placeholder = ''
    el.contentEditable = !disabledRef.current ? 'true' : 'false'
    el.setAttribute('role', 'textbox')
    el.setAttribute('aria-multiline', 'false')
    el.setAttribute('aria-label', 'Renglón de texto de la nota')
    el.spellcheck = true
    el.textContent = line.text

    const currentLineId = () => el.dataset.oanixMixedTextId ?? line.id
    el.addEventListener('input', () => apiRef.current.handleInput(currentLineId(), el))
    el.addEventListener('keydown', (event) => apiRef.current.handleKeyDown(event, currentLineId()))
    el.addEventListener('paste', (event) => apiRef.current.handlePaste(event, currentLineId()))
    el.addEventListener('compositionstart', () => {
      composingRef.current = true
      callbacksRef.current.onCompositionStart()
    })
    el.addEventListener('compositionend', () => {
      composingRef.current = false
      callbacksRef.current.onCompositionEnd()
      apiRef.current.handleInput(currentLineId(), el)
    })
    el.addEventListener('focus', () => apiRef.current.updateToolbar())
    el.addEventListener('click', () => apiRef.current.updateToolbar())
    el.addEventListener('keyup', () => apiRef.current.updateToolbar())
    el.addEventListener('pointerup', () => apiRef.current.updateToolbar())

    lineRefs.current.set(line.id, el)
    return el
  }

  function rebuildFromBlocks(source: readonly LineData[]) {
    const container = containerRef.current
    if (!container) return

    container.replaceChildren()
    lineRefs.current.clear()
    linesRef.current = cloneLines(source)
    for (const line of linesRef.current) {
      container.appendChild(buildLineEl(line))
    }
    lastSelectionRef.current = null
  }

  function reportSaveFailure() {
    callbacksRef.current.onError?.('No se pudo guardar el renglón de texto.')
  }

  function enqueueTask(task: () => Promise<boolean>) {
    const next = saveQueueRef.current.then(async () => {
      try {
        const saved = await task()
        if (!saved) reportSaveFailure()
        return saved
      } catch {
        reportSaveFailure()
        return false
      }
    })
    saveQueueRef.current = next
    return next
  }

  function takeDirtyBlocks() {
    const pending = [...dirtyBlocksRef.current.values()]
    dirtyBlocksRef.current.clear()
    return pending
  }

  async function flushPending() {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    const pending = takeDirtyBlocks()
    if (pending.length > 0) {
      enqueueTask(async () => {
        const saveBlockChanges = runtimeRef.current?.saveBlockChanges
        if (!saveBlockChanges) return false
        const saved = await saveBlockChanges({ upserts: pending })
        if (!saved) {
          for (const block of pending) {
            if (!dirtyBlocksRef.current.has(block.id)) dirtyBlocksRef.current.set(block.id, block)
          }
        }
        return saved
      })
    }

    return saveQueueRef.current
  }

  function scheduleTextSave(block: EditorSurfaceBlock) {
    dirtyBlocksRef.current.set(block.id, block)
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      void flushPending()
    }, TEXT_SAVE_IDLE_MS)
  }

  function enqueueStructuralSave(
    buildChanges: (globalBlocks: readonly EditorSurfaceBlock[]) => EditorSurfaceBlockChangeSet | null,
  ) {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const pending = takeDirtyBlocks()

    enqueueTask(async () => {
      const currentRuntime = runtimeRef.current
      if (!currentRuntime?.loadBlocks || !currentRuntime.saveBlockChanges) return false
      if (pending.length > 0 && !(await currentRuntime.saveBlockChanges({ upserts: pending }))) return false
      const globalBlocks = await currentRuntime.loadBlocks()
      const changes = buildChanges(globalBlocks)
      if (!changes) return true
      return currentRuntime.saveBlockChanges(changes)
    })
  }

  function enqueueSegmentOrderSave(
    previous: readonly LineData[],
    next: readonly LineData[],
    changed: readonly LineData[],
    deletes: readonly string[] = [],
  ) {
    const previousIds = new Set(previous.map((line) => line.id))

    enqueueStructuralSave((globalBlocks) => {
      const globalIds = globalBlocks.map((block) => block.id)
      const globalIdSet = new Set(globalIds)
      let anchor = globalIds.findIndex((id) => previousIds.has(id))
      if (anchor < 0) anchor = globalIds.length

      const withoutPrevious = globalIds.filter((id) => !previousIds.has(id))
      const beforeCount = globalIds.slice(0, anchor).filter((id) => !previousIds.has(id)).length
      withoutPrevious.splice(beforeCount, 0, ...next.map((line) => line.id))

      const explicitIds = new Set(changed.map((line) => line.id))
      const missing = next.filter((line) => !globalIdSet.has(line.id) && !explicitIds.has(line.id))
      const upserts = [...changed, ...missing]

      return {
        upserts: upserts.length > 0 ? upserts.map((line) => encodeTextBlock(line)) : undefined,
        deletes: deletes.length > 0 ? [...deletes] : undefined,
        order: withoutPrevious,
      }
    })
  }

  function setLineType(id: string, format: EditorTextBlockFormat) {
    const line = getLine(id)
    if (!line) return null

    const previousFormat = line.format ?? 'paragraph'
    const next = { ...line, format }
    linesRef.current = linesRef.current.map((item) => (item.id === id ? next : item))
    const el = getLineEl(id)
    if (el && isAtomicTextFormat(previousFormat) !== isAtomicTextFormat(format)) {
      const replacement = buildLineEl(next)
      el.replaceWith(replacement)
    } else if (el) {
      el.dataset.oanixTextFormat = format
    }
    return next
  }

  function insertLineAfter(refId: string, format: EditorTextBlockFormat, text: string) {
    const index = linesRef.current.findIndex((item) => item.id === refId)
    if (index < 0) return null
    const refEl = getLineEl(refId)
    if (!refEl) return null

    const line: LineData = {
      id: createTextLineId(),
      kind: linesRef.current[index].kind,
      text,
      format,
    }
    const el = buildLineEl(line)
    refEl.after(el)
    linesRef.current = [
      ...linesRef.current.slice(0, index + 1),
      line,
      ...linesRef.current.slice(index + 1),
    ]
    return line
  }

  function insertLineBefore(refId: string, format: EditorTextBlockFormat, text: string) {
    const index = linesRef.current.findIndex((item) => item.id === refId)
    if (index < 0) return null
    const refEl = getLineEl(refId)
    if (!refEl) return null

    const line: LineData = {
      id: createTextLineId(),
      kind: linesRef.current[index].kind,
      text,
      format,
    }
    const el = buildLineEl(line)
    refEl.before(el)
    linesRef.current = [
      ...linesRef.current.slice(0, index),
      line,
      ...linesRef.current.slice(index),
    ]
    return line
  }

  function ensureAtomicParagraphBoundaries(lineId: string) {
    const added: LineData[] = []
    let index = linesRef.current.findIndex((line) => line.id === lineId)
    const atomic = index >= 0 ? linesRef.current[index] : null
    if (!atomic || !isAtomicTextFormat(atomic.format)) return added

    if (!isEmptyParagraph(linesRef.current[index - 1])) {
      const before = insertLineBefore(lineId, 'paragraph', '')
      if (before) added.push(before)
    }

    index = linesRef.current.findIndex((line) => line.id === lineId)
    if (!isEmptyParagraph(linesRef.current[index + 1])) {
      const after = insertLineAfter(lineId, 'paragraph', '')
      if (after) added.push(after)
    }

    return added
  }

  function resetIfEmpty(line: LineData): LineData {
    const el = getLineEl(line.id)
    if (!el || el.textContent.trim().length > 0) return line
    if (line.format !== 'h2' && line.format !== 'h3') return line

    const next = { ...line, format: 'paragraph' as const }
    linesRef.current = linesRef.current.map((item) => (item.id === line.id ? next : item))
    el.dataset.oanixTextFormat = 'paragraph'
    return next
  }

  function focusFormattedLine(lineId: string, format: EditorTextBlockFormat, start = 0, end = start) {
    if (isAtomicTextFormat(format)) focusAtomicLine(lineId)
    else focusLine(lineId, start, end)
  }

  function applyAtomicFormat(format: EditorTextBlockFormat, ctx: CurrentContext) {
    const previous = cloneLines(linesRef.current)
    let atomic: LineData | null = null

    if (ctx.hasSelection && ctx.selectedText.trim().length > 0) {
      atomic = setLineType(ctx.line!.id, format)
    } else if (ctx.lineEl!.textContent.trim().length === 0) {
      atomic = setLineType(ctx.line!.id, format)
    } else {
      atomic = insertLineAfter(ctx.line!.id, format, '')
    }
    if (!atomic) return false

    const added = ensureAtomicParagraphBoundaries(atomic.id)
    const currentAtomic = getLine(atomic.id)
    if (!currentAtomic) return false

    enqueueSegmentOrderSave(
      previous,
      cloneLines(linesRef.current),
      [currentAtomic, ...added],
    )
    focusAtomicLine(currentAtomic.id)
    return true
  }

  function applyFormat(format: EditorTextBlockFormat) {
    const ctx = getCurrentContext()
    if (!ctx.line || !ctx.lineEl) return

    if (isAtomicTextFormat(format)) {
      if (!applyAtomicFormat(format, ctx)) return
      callbacksRef.current.onActivity()
      saveState()
      updateToolbar()
      return
    }

    if (ctx.hasSelection && ctx.selectedText.trim().length > 0) {
      const next = setLineType(ctx.line.id, format)
      if (next) enqueueStructuralSave(() => ({ upserts: [encodeTextBlock(next)] }))
      focusFormattedLine(ctx.line.id, format, ctx.selectionStart, ctx.selectionEnd)
    } else if (ctx.lineEl.textContent.trim().length === 0) {
      const next = setLineType(ctx.line.id, format)
      if (next) enqueueStructuralSave(() => ({ upserts: [encodeTextBlock(next)] }))
      focusFormattedLine(ctx.line.id, format)
    } else {
      const inserted = insertLineAfter(ctx.line.id, format, '')
      if (!inserted) return

      enqueueStructuralSave((globalBlocks) => {
        const targetIndex = globalBlocks.findIndex((block) => block.id === ctx.line!.id)
        const order = globalBlocks.map((block) => block.id)
        if (targetIndex >= 0) order.splice(targetIndex + 1, 0, inserted.id)
        return { upserts: [encodeTextBlock(inserted)], order }
      })
      focusLine(inserted.id, 0)
    }

    callbacksRef.current.onActivity()
    saveState()
    updateToolbar()
  }

  function removeAtomicBlock(lineId: string) {
    const index = linesRef.current.findIndex((line) => line.id === lineId)
    if (index < 0) return
    const line = linesRef.current[index]
    if (!isAtomicTextFormat(line.format)) return

    const previous = cloneLines(linesRef.current)
    getLineEl(lineId)?.remove()
    lineRefs.current.delete(lineId)
    dirtyBlocksRef.current.delete(lineId)
    linesRef.current = linesRef.current.filter((item) => item.id !== lineId)

    const changed: LineData[] = []
    if (linesRef.current.length === 0) {
      const fallback = createEmptyParagraph(line.kind)
      linesRef.current = [fallback]
      containerRef.current?.appendChild(buildLineEl(fallback))
      changed.push(fallback)
    }

    const next = cloneLines(linesRef.current)
    enqueueSegmentOrderSave(previous, next, changed, [lineId])

    const target = linesRef.current[Math.min(index, linesRef.current.length - 1)]
      ?? linesRef.current[Math.max(0, index - 1)]
    callbacksRef.current.onActivity()
    saveState()
    if (target && !isAtomicTextFormat(target.format)) focusLine(target.id, 0)
    updateToolbar()
  }

  function handleEnter() {
    const ctx = readLiveContext()
    if (!ctx.line || !ctx.lineEl) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)

    const beforeRange = document.createRange()
    beforeRange.setStart(ctx.lineEl, 0)
    beforeRange.setEnd(range.startContainer, range.startOffset)
    const beforeText = beforeRange.toString()

    const afterRange = document.createRange()
    afterRange.setStart(range.endContainer, range.endOffset)
    afterRange.setEnd(ctx.lineEl, ctx.lineEl.childNodes.length)
    const afterText = afterRange.toString()

    const index = linesRef.current.findIndex((item) => item.id === ctx.line!.id)
    if (index < 0) return

    const current = headingToParagraphIfEmpty({ ...ctx.line, text: beforeText })
    ctx.lineEl.textContent = beforeText
    ctx.lineEl.dataset.oanixTextFormat = current.format ?? 'paragraph'

    const next: LineData = {
      id: createTextLineId(),
      kind: ctx.line.kind,
      text: afterText,
      format: 'paragraph',
    }
    const nextEl = buildLineEl(next)
    ctx.lineEl.after(nextEl)

    linesRef.current = [
      ...linesRef.current.slice(0, index),
      current,
      next,
      ...linesRef.current.slice(index + 1),
    ]

    dirtyBlocksRef.current.delete(current.id)
    dirtyBlocksRef.current.delete(next.id)
    enqueueStructuralSave((globalBlocks) => {
      const targetIndex = globalBlocks.findIndex((block) => block.id === current.id)
      const order = globalBlocks.map((block) => block.id)
      if (targetIndex >= 0) order.splice(targetIndex + 1, 0, next.id)
      return {
        upserts: [encodeTextBlock(current), encodeTextBlock(next)],
        order,
      }
    })

    focusLine(next.id)
    callbacksRef.current.onActivity()
    saveState()
    updateToolbar()
  }

  function mergeWithPrevious(index: number) {
    if (index <= 0 || index >= linesRef.current.length) return

    const current = linesRef.current[index]
    const previous = linesRef.current[index - 1]
    if (isAtomicTextFormat(current.format) || isAtomicTextFormat(previous.format)) return

    const currentEl = getLineEl(current.id)
    const previousEl = getLineEl(previous.id)
    if (!currentEl || !previousEl || !currentEl.matches(LINE_SELECTOR) || !previousEl.matches(LINE_SELECTOR)) return

    const previousText = previousEl.textContent
    const currentText = currentEl.textContent
    const caretAt = previousText.length
    const merged: LineData = {
      ...previous,
      text: previousText + currentText,
    }

    previousEl.remove()
    lineRefs.current.delete(previous.id)
    lineRefs.current.delete(current.id)
    currentEl.dataset.oanixMixedTextId = previous.id
    currentEl.dataset.oanixTextFormat = merged.format ?? 'paragraph'
    currentEl.textContent = merged.text
    lineRefs.current.set(previous.id, currentEl)
    linesRef.current = [
      ...linesRef.current.slice(0, index - 1),
      merged,
      ...linesRef.current.slice(index + 1),
    ]

    dirtyBlocksRef.current.delete(current.id)
    dirtyBlocksRef.current.delete(previous.id)
    enqueueStructuralSave((globalBlocks) => ({
      upserts: [encodeTextBlock(merged)],
      deletes: [current.id],
      order: globalBlocks.filter((block) => block.id !== current.id).map((block) => block.id),
    }))

    placeSelection(currentEl, caretAt)
    activateInteractionTarget()
    currentEl.scrollIntoView({ block: 'nearest' })
    callbacksRef.current.onTextCursorChange?.(previous.id, caretAt)
    callbacksRef.current.onActivity()
    updateToolbar()
  }

  function persistRestoredState(previous: readonly LineData[], next: readonly LineData[]) {
    const previousIds = new Set(previous.map((line) => line.id))
    const nextIds = new Set(next.map((line) => line.id))
    const deletes = [...previousIds].filter((id) => !nextIds.has(id))
    for (const id of deletes) dirtyBlocksRef.current.delete(id)
    for (const line of next) dirtyBlocksRef.current.delete(line.id)

    enqueueStructuralSave((globalBlocks) => {
      const currentIds = new Set(previous.map((line) => line.id))
      const globalIds = globalBlocks.map((block) => block.id)
      let anchor = globalIds.findIndex((id) => currentIds.has(id))
      if (anchor < 0) anchor = globalIds.length
      const withoutCurrent = globalIds.filter((id) => !currentIds.has(id))
      const beforeCount = globalIds.slice(0, anchor).filter((id) => !currentIds.has(id)).length
      withoutCurrent.splice(beforeCount, 0, ...next.map((line) => line.id))
      return {
        upserts: next.map((line) => encodeTextBlock(line)),
        deletes: deletes.length > 0 ? deletes : undefined,
        order: withoutCurrent,
      }
    })
  }

  function restoreFocusAfterHistory(preferredId: string | null) {
    const target = preferredId && getLine(preferredId)
      ? preferredId
      : linesRef.current[linesRef.current.length - 1]?.id ?? null
    if (!target) return
    const line = getLine(target)
    if (isAtomicTextFormat(line?.format)) focusAtomicLine(target)
    else focusLine(target)
  }

  function undo() {
    if (undoStackRef.current.length <= 1) return

    const previousFocus = getCurrentContext().line?.id ?? null
    const current = undoStackRef.current.pop()
    if (current) redoStackRef.current.push(current)
    const previous = cloneLines(linesRef.current)
    const next = cloneLines(undoStackRef.current[undoStackRef.current.length - 1])
    persistRestoredState(previous, next)
    rebuildFromBlocks(next)
    restoreFocusAfterHistory(previousFocus)
    callbacksRef.current.onActivity()
    updateToolbar()
  }

  function redo() {
    if (redoStackRef.current.length === 0) return

    const previousFocus = getCurrentContext().line?.id ?? null
    const next = cloneLines(redoStackRef.current.pop()!)
    const previous = cloneLines(linesRef.current)
    undoStackRef.current.push(cloneLines(next))
    persistRestoredState(previous, next)
    rebuildFromBlocks(next)
    restoreFocusAfterHistory(previousFocus)
    callbacksRef.current.onActivity()
    updateToolbar()
  }

  function handleInput(lineId: string, el: HTMLDivElement) {
    if (composingRef.current) return

    const line = getLine(lineId)
    if (!line || isAtomicTextFormat(line.format)) return
    let next: LineData = { ...line, text: el.textContent }
    linesRef.current = linesRef.current.map((item) => (item.id === lineId ? next : item))
    next = resetIfEmpty(next)

    callbacksRef.current.onActivity()
    scheduleTextSave(encodeTextBlock(next))
    const ctx = readLiveContext()
    if (ctx.line) callbacksRef.current.onTextCursorChange?.(ctx.line.id, ctx.offset)
  }

  function handleKeyDown(event: KeyboardEvent, lineId: string) {
    if (event.isComposing || composingRef.current) return

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
      return
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault()
      redo()
      return
    }

    if (event.altKey || event.ctrlKey || event.metaKey) return
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleEnter()
      return
    }

    if (event.key !== 'Backspace' || event.shiftKey) return
    const ctx = readLiveContext()
    if (!ctx.line || ctx.line.id !== lineId || ctx.hasSelection || ctx.offset !== 0) return

    const index = linesRef.current.findIndex((item) => item.id === lineId)
    if (index <= 0) return

    const previous = linesRef.current[index - 1]
    if (previous && isAtomicTextFormat(previous.format)) {
      event.preventDefault()
      return
    }

    event.preventDefault()
    mergeWithPrevious(index)
    saveState()
  }

  function handlePaste(event: ClipboardEvent, lineId: string) {
    if (disabledRef.current) return
    const clipboardData = event.clipboardData
    if (!clipboardData) return

    const image = findOanixClipboardImage(clipboardData)
    if (image && callbacksRef.current.onPasteImage) {
      event.preventDefault()
      const ctx = readLiveContext()
      const line = getLine(lineId)
      const cursorOffset = ctx.line?.id === lineId ? ctx.offset : (line?.text.length ?? 0)
      void flushPending().then(() => callbacksRef.current.onPasteImage?.(image, lineId, cursorOffset))
      return
    }

    event.preventDefault()
    const text = clipboardData.getData('text/plain') || ''
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const node = document.createTextNode(text)
    range.deleteContents()
    range.insertNode(node)

    const nextRange = document.createRange()
    nextRange.setStartAfter(node)
    nextRange.collapse(true)
    selection.removeAllRanges()
    selection.addRange(nextRange)

    const lineEl = node.parentElement?.closest<HTMLDivElement>(LINE_SELECTOR) ?? null
    const id = lineEl?.dataset.oanixMixedTextId
    const current = id ? getLine(id) : null
    if (current && lineEl) {
      const next = resetIfEmpty({ ...current, text: lineEl.textContent })
      linesRef.current = linesRef.current.map((item) => (item.id === next.id ? next : item))
      scheduleTextSave(encodeTextBlock(next))
      callbacksRef.current.onActivity()
      const ctx = readLiveContext()
      if (ctx.line) callbacksRef.current.onTextCursorChange?.(ctx.line.id, ctx.offset)
    }

    saveState()
    updateToolbar()
  }

  function updateToolbar() {
    const ctx = getCurrentContext()
    const root = containerRef.current?.closest<HTMLElement>('.oanix-notes')
    root?.querySelectorAll<HTMLButtonElement>('.oanix-notes__tool[data-tool]').forEach((button) => {
      const format = button.dataset.tool as EditorTextBlockFormat | undefined
      if (!format || !TEXT_FORMATS.has(format)) return
      button.classList.toggle('is-active', Boolean(ctx.line && format === (ctx.line.format ?? 'paragraph')))
    })
    if (ctx.line) callbacksRef.current.onTextCursorChange?.(ctx.line.id, ctx.offset)
  }

  const apiRef = useRef({
    applyFormat,
    handleEnter,
    mergeWithPrevious,
    resetIfEmpty,
    handleInput,
    handleKeyDown,
    handlePaste,
    updateToolbar,
    flushPending,
    undo,
    redo,
  })
  apiRef.current = {
    applyFormat,
    handleEnter,
    mergeWithPrevious,
    resetIfEmpty,
    handleInput,
    handleKeyDown,
    handlePaste,
    updateToolbar,
    flushPending,
    undo,
    redo,
  }

  useEffect(() => {
    const initial = cloneLines(initialLinesRef.current)
    const normalized = withAtomicParagraphBoundaries(initial)
    rebuildFromBlocks(normalized.lines)
    undoStackRef.current = [cloneLines(linesRef.current)]
    redoStackRef.current = []

    if (normalized.added.length > 0) {
      enqueueSegmentOrderSave(initial, normalized.lines, normalized.added)
    }

    return () => {
      containerRef.current?.replaceChildren()
      lineRefs.current.clear()
    }
  }, [])

  useEffect(() => {
    const noteId = runtime?.noteId
    return () => {
      if (noteId && activeTextLineEditorByNote.get(noteId) === editorTokenRef.current) {
        activeTextLineEditorByNote.delete(noteId)
      }
    }
  }, [runtime?.noteId])

  useEffect(() => {
    disabledRef.current = disabled
    lineRefs.current.forEach((el) => {
      if (el.matches(LINE_SELECTOR)) {
        el.contentEditable = !disabled ? 'true' : 'false'
        return
      }
      el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>('input, textarea, button')
        .forEach((control) => { control.disabled = disabled })
    })
  }, [disabled])

  useEffect(() => {
    if (externalSignature === lastExternalSignatureRef.current) return
    lastExternalSignatureRef.current = externalSignature

    if (externalSignature === lineSignature(linesRef.current)) return

    void flushPending().then(() => {
      rebuildFromBlocks(decodedExternal)
      undoStackRef.current = [cloneLines(linesRef.current)]
      redoStackRef.current = []
    })
  }, [externalSignature, decodedExternal])

  useEffect(() => {
    const noteId = runtimeRef.current?.noteId
    if (!noteId) return
    return registerOanixTextLineFlusher(noteId, () => apiRef.current.flushPending())
  }, [runtime?.noteId, runtime?.saveBlockChanges])

  useEffect(() => () => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current)
  }, [])

  useEffect(() => {
    const handleSelectionChange = () => {
      const ctx = readLiveContext()
      if (ctx.line) updateToolbar()
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!isActiveInteractionTarget()) return
      const target = event.target
      if (!(target instanceof Element)) return

      const root = target.closest<HTMLElement>('.oanix-notes')
      if (!root || root.dataset.noteId !== runtimeRef.current?.noteId) return

      const panelOpener = target.closest<HTMLElement>('button[aria-label="Más"], .oanix-notes__slide-handle')
      if (panelOpener && getCurrentContext().line) {
        event.preventDefault()
        const active = document.activeElement
        if (active instanceof HTMLElement) active.blur()
        window.getSelection()?.removeAllRanges()
        return
      }

      const formatButton = target.closest<HTMLButtonElement>('button[data-tool]')
      const format = formatButton?.dataset.tool as EditorTextBlockFormat | undefined
      if (formatButton && format && TEXT_FORMATS.has(format) && getCurrentContext().line) {
        event.preventDefault()
        return
      }

      const historyButton = target.closest<HTMLButtonElement>(
        'button[aria-label="Deshacer"], button[aria-label="Rehacer"]',
      )
      if (historyButton && getCurrentContext().line) event.preventDefault()
    }

    const handleClick = (event: MouseEvent) => {
      if (!isActiveInteractionTarget()) return
      const target = event.target
      if (!(target instanceof Element)) return

      const root = target.closest<HTMLElement>('.oanix-notes')
      if (!root || root.dataset.noteId !== runtimeRef.current?.noteId) return

      const formatButton = target.closest<HTMLButtonElement>('button[data-tool]')
      const format = formatButton?.dataset.tool as EditorTextBlockFormat | undefined
      if (formatButton && format && TEXT_FORMATS.has(format) && getCurrentContext().line) {
        event.preventDefault()
        event.stopImmediatePropagation()
        root.querySelector<HTMLButtonElement>('.oanix-notes__panel-close')?.click()
        apiRef.current.applyFormat(format)
        return
      }

      const historyButton = target.closest<HTMLButtonElement>(
        'button[aria-label="Deshacer"], button[aria-label="Rehacer"]',
      )
      if (!historyButton || !getCurrentContext().line) return

      event.preventDefault()
      event.stopImmediatePropagation()
      if (historyButton.getAttribute('aria-label') === 'Deshacer') apiRef.current.undo()
      else apiRef.current.redo()
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('click', handleClick, true)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('click', handleClick, true)
    }
  }, [runtime?.noteId])

  return <div ref={containerRef} className="oanix-text-line-editor" data-oanix-text-lines="true" />
}
