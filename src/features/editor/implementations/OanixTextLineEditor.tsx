import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  ClipboardEvent as ReactClipboardEvent,
  FormEvent as ReactFormEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react'
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
  hasSelection: boolean
  selectedText: string
}

const TEXT_FORMATS = new Set<EditorTextBlockFormat>([
  'paragraph',
  'h2',
  'h3',
  'quote',
  'list',
  'numbered-list',
])
const TEXT_SAVE_IDLE_MS = 3_000

function createTextLineId() {
  return `oanix-text-${crypto.randomUUID()}`
}

function cloneLines(lines: readonly LineData[]) {
  return lines.map((line) => ({ ...line }))
}

function decodeLines(blocks: readonly EditorSurfaceBlock[]) {
  return blocks.map((block) => decodeTextBlock(block)).filter((block): block is LineData => Boolean(block))
}

function lineSignature(lines: readonly LineData[]) {
  return lines.map((line) => `${line.id}\u0000${line.format ?? 'paragraph'}\u0000${line.text}`).join('\u0001')
}

function paragraphIfEmpty(line: LineData): LineData {
  if (line.text.trim().length > 0 || line.format === 'paragraph') return line
  return { ...line, format: 'paragraph' }
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
  const dirtyBlocksRef = useRef(new Map<string, EditorSurfaceBlock>())
  const saveTimerRef = useRef<number | null>(null)
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true))
  const composingRef = useRef(false)
  const undoStackRef = useRef<LineData[][]>([])
  const redoStackRef = useRef<LineData[][]>([])

  const decodedExternal = useMemo(() => decodeLines(blocks), [blocks])
  const externalSignature = useMemo(() => lineSignature(decodedExternal), [decodedExternal])
  const [lines, setLines] = useState<LineData[]>(() => cloneLines(decodedExternal))
  const linesRef = useRef(lines)
  const lastExternalSignatureRef = useRef(externalSignature)

  function replaceLines(next: LineData[]) {
    linesRef.current = next
    setLines(next)
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

  function getCurrentContext(): CurrentContext {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      return { lineEl: null, line: null, offset: 0, hasSelection: false, selectedText: '' }
    }

    const range = selection.getRangeAt(0)
    const anchor = range.startContainer
    const candidate = anchor.nodeType === Node.TEXT_NODE
      ? anchor.parentElement?.closest<HTMLDivElement>('.oanix-text-line-editor__line') ?? null
      : anchor instanceof Element
        ? anchor.closest<HTMLDivElement>('.oanix-text-line-editor__line')
        : null
    const lineEl = candidate && containerRef.current?.contains(candidate) ? candidate : null
    if (!lineEl) {
      return { lineEl: null, line: null, offset: 0, hasSelection: false, selectedText: '' }
    }

    const id = lineEl.dataset.oanixMixedTextId
    const line = id ? getLine(id) : null
    if (!line) {
      return { lineEl: null, line: null, offset: 0, hasSelection: false, selectedText: '' }
    }

    let offset = 0
    try {
      const before = document.createRange()
      before.setStart(lineEl, 0)
      before.setEnd(range.startContainer, range.startOffset)
      offset = before.toString().length
    } catch {
      offset = range.startOffset
    }

    return {
      lineEl,
      line,
      offset: Math.max(0, offset),
      hasSelection: !selection.isCollapsed,
      selectedText: !selection.isCollapsed ? range.toString() : '',
    }
  }

  function focusLine(lineId: string, offset?: number) {
    window.requestAnimationFrame(() => {
      const el = getLineEl(lineId)
      if (!el) return
      el.focus({ preventScroll: true })

      const range = document.createRange()
      const selection = window.getSelection()
      const textNode = el.firstChild
      if (typeof offset === 'number' && textNode?.nodeType === Node.TEXT_NODE) {
        range.setStart(textNode, Math.min(Math.max(0, offset), textNode.textContent?.length ?? 0))
        range.collapse(true)
      } else {
        range.selectNodeContents(el)
        range.collapse(false)
      }
      selection?.removeAllRanges()
      selection?.addRange(range)
      el.scrollIntoView({ block: 'nearest' })
      const ctx = getCurrentContext()
      if (ctx.line) onTextCursorChange?.(ctx.line.id, ctx.offset)
    })
  }

  function updateToolbar() {
    const ctx = getCurrentContext()
    const root = containerRef.current?.closest<HTMLElement>('.oanix-notes')
    root?.querySelectorAll<HTMLButtonElement>('.oanix-notes__tool[data-tool]').forEach((button) => {
      const format = button.dataset.tool as EditorTextBlockFormat | undefined
      if (!format || !TEXT_FORMATS.has(format)) return
      button.classList.toggle('is-active', Boolean(ctx.line && format === (ctx.line.format ?? 'paragraph')))
    })
    if (ctx.line) onTextCursorChange?.(ctx.line.id, ctx.offset)
  }

  function reportSaveFailure() {
    onError?.('No se pudo guardar el renglón de texto.')
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
        if (!runtime?.saveBlockChanges) return false
        const saved = await runtime.saveBlockChanges({ upserts: pending })
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
      if (!runtime?.loadBlocks || !runtime.saveBlockChanges) return false
      if (pending.length > 0 && !(await runtime.saveBlockChanges({ upserts: pending }))) return false
      const globalBlocks = await runtime.loadBlocks()
      const changes = buildChanges(globalBlocks)
      if (!changes) return true
      return runtime.saveBlockChanges(changes)
    })
  }

  function setLineType(id: string, format: EditorTextBlockFormat) {
    const line = getLine(id)
    if (!line) return null
    const next = { ...line, format }
    linesRef.current = linesRef.current.map((item) => item.id === id ? next : item)
    setLines([...linesRef.current])
    return next
  }

  function insertLineAfter(refId: string, format: EditorTextBlockFormat, text: string) {
    const index = linesRef.current.findIndex((line) => line.id === refId)
    if (index < 0) return null
    const ref = linesRef.current[index]
    const line: LineData = {
      id: createTextLineId(),
      kind: ref.kind,
      text,
      format,
    }
    replaceLines([
      ...linesRef.current.slice(0, index + 1),
      line,
      ...linesRef.current.slice(index + 1),
    ])
    return line
  }

  function resetIfEmpty(line: LineData) {
    const el = getLineEl(line.id)
    if (!el || el.textContent.trim().length > 0 || line.format === 'paragraph') return line
    const next = { ...line, format: 'paragraph' as const }
    linesRef.current = linesRef.current.map((item) => item.id === line.id ? next : item)
    el.dataset.oanixTextFormat = 'paragraph'
    return next
  }

  function applyFormat(format: EditorTextBlockFormat) {
    const ctx = getCurrentContext()
    if (!ctx.line || !ctx.lineEl) return

    if (ctx.hasSelection && ctx.selectedText.trim().length > 0) {
      const next = setLineType(ctx.line.id, format)
      if (next) enqueueStructuralSave(() => ({ upserts: [encodeTextBlock(next)] }))
    } else if (ctx.lineEl.textContent.trim().length === 0) {
      const next = setLineType(ctx.line.id, format)
      if (next) enqueueStructuralSave(() => ({ upserts: [encodeTextBlock(next)] }))
    } else {
      const inserted = insertLineAfter(ctx.line.id, format, '')
      if (!inserted) return
      enqueueStructuralSave((globalBlocks) => {
        const targetIndex = globalBlocks.findIndex((block) => block.id === ctx.line!.id)
        const order = globalBlocks.map((block) => block.id)
        if (targetIndex >= 0) order.splice(targetIndex + 1, 0, inserted.id)
        return { upserts: [encodeTextBlock(inserted)], order }
      })
      focusLine(inserted.id)
    }

    onActivity()
    saveState()
    updateToolbar()
  }

  function handleEnter() {
    const ctx = getCurrentContext()
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

    const current = paragraphIfEmpty({ ...ctx.line, text: beforeText })
    const next: LineData = {
      id: createTextLineId(),
      kind: ctx.line.kind,
      text: afterText,
      format: 'paragraph',
    }
    const index = linesRef.current.findIndex((line) => line.id === ctx.line!.id)
    replaceLines([
      ...linesRef.current.slice(0, index),
      current,
      next,
      ...linesRef.current.slice(index + 1),
    ])

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

    onActivity()
    focusLine(next.id)
    saveState()
    updateToolbar()
  }

  function mergeWithPrevious(index: number) {
    if (index <= 0 || index >= linesRef.current.length) return
    const current = linesRef.current[index]
    const previous = linesRef.current[index - 1]
    const currentEl = getLineEl(current.id)
    const previousEl = getLineEl(previous.id)
    const previousText = previousEl?.textContent ?? previous.text
    const currentText = currentEl?.textContent ?? current.text
    const caretAt = previousText.length
    const merged = { ...previous, text: previousText + currentText }

    replaceLines([
      ...linesRef.current.slice(0, index - 1),
      merged,
      ...linesRef.current.slice(index + 1),
    ])
    dirtyBlocksRef.current.delete(current.id)
    dirtyBlocksRef.current.delete(previous.id)
    enqueueStructuralSave((globalBlocks) => ({
      upserts: [encodeTextBlock(merged)],
      deletes: [current.id],
      order: globalBlocks.filter((block) => block.id !== current.id).map((block) => block.id),
    }))

    onActivity()
    focusLine(merged.id, caretAt)
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

  function undo() {
    if (undoStackRef.current.length <= 1) return
    const previous = cloneLines(linesRef.current)
    const current = undoStackRef.current.pop()
    if (current) redoStackRef.current.push(current)
    const next = cloneLines(undoStackRef.current[undoStackRef.current.length - 1])
    replaceLines(next)
    persistRestoredState(previous, next)
    onActivity()
    updateToolbar()
  }

  function redo() {
    if (redoStackRef.current.length === 0) return
    const previous = cloneLines(linesRef.current)
    const next = cloneLines(redoStackRef.current.pop()!)
    undoStackRef.current.push(cloneLines(next))
    replaceLines(next)
    persistRestoredState(previous, next)
    onActivity()
    updateToolbar()
  }

  function handleInput(event: ReactFormEvent<HTMLDivElement>, lineId: string) {
    if (composingRef.current) return
    const line = getLine(lineId)
    if (!line) return
    const text = event.currentTarget.textContent
    let next: LineData = { ...line, text }
    linesRef.current = linesRef.current.map((item) => item.id === lineId ? next : item)
    next = resetIfEmpty(next)
    onActivity()
    scheduleTextSave(encodeTextBlock(next))
    const ctx = getCurrentContext()
    if (ctx.line) onTextCursorChange?.(ctx.line.id, ctx.offset)
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, line: LineData) {
    if (event.nativeEvent.isComposing || composingRef.current) return

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
    const ctx = getCurrentContext()
    if (!ctx.line || ctx.line.id !== line.id || ctx.hasSelection || ctx.offset !== 0) return
    const index = linesRef.current.findIndex((item) => item.id === line.id)
    if (index <= 0) return
    event.preventDefault()
    mergeWithPrevious(index)
    saveState()
  }

  function handlePaste(event: ReactClipboardEvent<HTMLDivElement>, line: LineData) {
    if (disabled) return
    const image = findOanixClipboardImage(event.clipboardData)
    if (image && onPasteImage) {
      event.preventDefault()
      const ctx = getCurrentContext()
      const cursorOffset = ctx.line?.id === line.id ? ctx.offset : line.text.length
      void flushPending().then(() => onPasteImage(image, line.id, cursorOffset))
      return
    }

    event.preventDefault()
    const text = event.clipboardData.getData('text/plain') || ''
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

    const lineEl = node.parentElement?.closest<HTMLDivElement>('.oanix-text-line-editor__line')
    const id = lineEl?.dataset.oanixMixedTextId
    const current = id ? getLine(id) : null
    if (current && lineEl) {
      const next = resetIfEmpty({ ...current, text: lineEl.textContent })
      linesRef.current = linesRef.current.map((item) => item.id === next.id ? next : item)
      scheduleTextSave(encodeTextBlock(next))
      onActivity()
    }
    saveState()
    updateToolbar()
  }

  useEffect(() => {
    if (undoStackRef.current.length === 0) saveState()
  }, [])

  useEffect(() => {
    if (!runtime) return
    return registerOanixTextLineFlusher(runtime.noteId, flushPending)
  }, [runtime?.noteId, runtime?.saveBlockChanges])

  useEffect(() => () => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current)
  }, [])

  useEffect(() => {
    if (externalSignature === lastExternalSignatureRef.current) return
    lastExternalSignatureRef.current = externalSignature
    void flushPending().then(() => {
      const next = cloneLines(decodedExternal)
      replaceLines(next)
      undoStackRef.current = [cloneLines(next)]
      redoStackRef.current = []
    })
  }, [externalSignature])

  useEffect(() => {
    const handleSelectionChange = () => updateToolbar()
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element) || !runtime) return
      const root = target.closest<HTMLElement>('.oanix-notes')
      if (root?.dataset.noteId !== runtime.noteId) return

      const formatButton = target.closest<HTMLButtonElement>('button[data-tool]')
      const format = formatButton?.dataset.tool as EditorTextBlockFormat | undefined
      if (formatButton && format && TEXT_FORMATS.has(format) && getCurrentContext().line) {
        event.preventDefault()
        return
      }

      const historyButton = target.closest<HTMLButtonElement>('button[aria-label="Deshacer"], button[aria-label="Rehacer"]')
      if (historyButton && getCurrentContext().line) event.preventDefault()
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element) || !runtime) return
      const root = target.closest<HTMLElement>('.oanix-notes')
      if (root?.dataset.noteId !== runtime.noteId) return

      const formatButton = target.closest<HTMLButtonElement>('button[data-tool]')
      const format = formatButton?.dataset.tool as EditorTextBlockFormat | undefined
      if (formatButton && format && TEXT_FORMATS.has(format) && getCurrentContext().line) {
        event.preventDefault()
        event.stopImmediatePropagation()
        applyFormat(format)
        return
      }

      const historyButton = target.closest<HTMLButtonElement>('button[aria-label="Deshacer"], button[aria-label="Rehacer"]')
      if (!historyButton || !getCurrentContext().line) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (historyButton.getAttribute('aria-label') === 'Deshacer') undo()
      else redo()
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

  return <div ref={containerRef} className="oanix-text-line-editor" data-oanix-text-lines="true">
    {lines.map((line) => <div
      key={line.id}
      ref={(node) => {
        if (node) lineRefs.current.set(line.id, node)
        else lineRefs.current.delete(line.id)
      }}
      className="oanix-mixed-document__text oanix-text-line-editor__line"
      data-oanix-mixed-text-id={line.id}
      data-oanix-text-format={line.format ?? 'paragraph'}
      data-placeholder=""
      contentEditable={!disabled}
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="false"
      aria-label="Renglón de texto de la nota"
      spellCheck
      onInput={(event) => handleInput(event, line.id)}
      onFocus={() => updateToolbar()}
      onClick={() => window.setTimeout(updateToolbar, 10)}
      onKeyUp={() => updateToolbar()}
      onPointerUp={() => updateToolbar()}
      onKeyDown={(event) => handleKeyDown(event, line)}
      onPaste={(event) => handlePaste(event, line)}
      onCompositionStart={() => {
        composingRef.current = true
        onCompositionStart()
      }}
      onCompositionEnd={(event) => {
        composingRef.current = false
        onCompositionEnd()
        handleInput(event, line.id)
      }}
    >{line.text}</div>)}
  </div>
}
