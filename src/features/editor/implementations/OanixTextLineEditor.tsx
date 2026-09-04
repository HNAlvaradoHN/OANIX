import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  ClipboardEvent as ReactClipboardEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import type { EditorSurfaceBlock, EditorSurfaceBlockChangeSet } from '../editorSurfaceContract.ts'
import { findOanixClipboardImage } from '../oanixClipboardImage.ts'
import {
  applyTextLineFormat,
  backspaceTextLineBoundary,
  enterTextLine,
  normalizeTextLines,
} from '../oanixTextLineModel.ts'
import {
  readOanixTextLineSelection,
  registerOanixTextLineFlusher,
  rememberOanixTextLineSelection,
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

const TEXT_FORMATS = new Set<EditorTextBlockFormat>([
  'paragraph',
  'h2',
  'h3',
  'quote',
  'list',
  'numbered-list',
])
const TEXT_SAVE_IDLE_MS = 650

function createTextLineId() {
  return `oanix-text-${crypto.randomUUID()}`
}

function lineSignature(lines: readonly EditorTextBlock[]) {
  return lines.map((line) => `${line.id}\u0000${line.format ?? 'paragraph'}\u0000${line.text}`).join('\u0001')
}

function decodeLines(blocks: readonly EditorSurfaceBlock[]) {
  return blocks.map((block) => decodeTextBlock(block)).filter((block): block is EditorTextBlock => Boolean(block))
}

function minimumHeight(format: EditorTextBlockFormat | undefined) {
  if (format === 'h2') return 42
  if (format === 'h3') return 36
  if (format === 'paragraph') return 30
  return 48
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
  const textareaRefs = useRef(new Map<string, HTMLTextAreaElement>())
  const dirtyBlocksRef = useRef(new Map<string, EditorSurfaceBlock>())
  const saveTimerRef = useRef<number | null>(null)
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true))
  const composingRef = useRef(false)

  const decodedExternal = useMemo(() => decodeLines(blocks), [blocks])
  const externalSignature = useMemo(() => lineSignature(decodedExternal), [decodedExternal])
  const initialRef = useRef<ReturnType<typeof normalizeTextLines> | null>(null)
  const initialNormalized = initialRef.current ?? normalizeTextLines(decodedExternal, createTextLineId)
  if (!initialRef.current) initialRef.current = initialNormalized

  const [lines, setLines] = useState<EditorTextBlock[]>(initialNormalized.lines)
  const linesRef = useRef(lines)
  const lastExternalSignatureRef = useRef(externalSignature)

  const replaceLines = (next: EditorTextBlock[]) => {
    linesRef.current = next
    setLines(next)
  }

  const resizeLine = (lineId: string) => {
    const textarea = textareaRefs.current.get(lineId)
    const line = linesRef.current.find((item) => item.id === lineId)
    if (!textarea || !line) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.max(minimumHeight(line.format), textarea.scrollHeight)}px`
  }

  const keepLineVisible = (lineId: string) => {
    const textarea = textareaRefs.current.get(lineId)
    if (!textarea) return
    window.requestAnimationFrame(() => {
      textarea.scrollIntoView({ block: 'nearest' })
      window.requestAnimationFrame(() => textarea.scrollIntoView({ block: 'nearest' }))
    })
  }

  const rememberSelection = (lineId: string, selectionStart: number, selectionEnd: number) => {
    if (!runtime) return
    rememberOanixTextLineSelection({
      noteId: runtime.noteId,
      blockId: lineId,
      selectionStart: Math.max(0, selectionStart),
      selectionEnd: Math.max(0, selectionEnd),
    })
    onTextCursorChange?.(lineId, Math.max(0, selectionStart))
  }

  const focusLine = (lineId: string, offset: number) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const textarea = textareaRefs.current.get(lineId)
      if (!textarea) return
      const safeOffset = Math.min(Math.max(0, offset), textarea.value.length)
      textarea.focus({ preventScroll: true })
      textarea.setSelectionRange(safeOffset, safeOffset)
      rememberSelection(lineId, safeOffset, safeOffset)
      resizeLine(lineId)
      keepLineVisible(lineId)
    }))
  }

  const reportSaveFailure = () => onError?.('No se pudo guardar el renglón de texto.')

  const enqueueTask = (task: () => Promise<boolean>) => {
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

  const takeDirtyBlocks = () => {
    const pending = [...dirtyBlocksRef.current.values()]
    dirtyBlocksRef.current.clear()
    return pending
  }

  const flushPending = async () => {
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

  const scheduleTextSave = (block: EditorSurfaceBlock) => {
    dirtyBlocksRef.current.set(block.id, block)
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      void flushPending()
    }, TEXT_SAVE_IDLE_MS)
  }

  const enqueueStructuralSave = (
    buildChanges: (globalBlocks: readonly EditorSurfaceBlock[]) => EditorSurfaceBlockChangeSet | null,
  ) => {
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

  useEffect(() => {
    if (!runtime) return
    return registerOanixTextLineFlusher(runtime.noteId, flushPending)
  }, [runtime?.noteId, runtime?.saveBlockChanges])

  useEffect(() => () => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current)
  }, [])

  useEffect(() => {
    for (const line of lines) resizeLine(line.id)
  }, [lines])

  useEffect(() => {
    if (externalSignature === lastExternalSignatureRef.current) return
    lastExternalSignatureRef.current = externalSignature
    void flushPending().then(() => {
      const normalized = normalizeTextLines(decodedExternal, createTextLineId)
      replaceLines(normalized.lines)
    })
  }, [externalSignature])

  useEffect(() => {
    const normalized = initialRef.current
    if (!normalized?.changed || !runtime?.loadBlocks || !runtime.saveBlockChanges) return

    enqueueStructuralSave((globalBlocks) => {
      const order = globalBlocks.flatMap((block) => {
        const replacement = normalized.replacementBySourceId.get(block.id)
        return replacement ? replacement.map((line) => line.id) : [block.id]
      })
      return {
        upserts: normalized.lines.map((line) => encodeTextBlock(line)),
        order,
      }
    })
  }, [runtime?.noteId])

  const applyFormat = (
    blockId: string,
    selectionStart: number,
    selectionEnd: number,
    format: EditorTextBlockFormat,
  ) => {
    const result = applyTextLineFormat(
      linesRef.current,
      blockId,
      selectionStart,
      selectionEnd,
      format,
      createTextLineId,
    )
    if (!result) return

    replaceLines(result.lines)
    onActivity()
    for (const deletedId of result.deletes) dirtyBlocksRef.current.delete(deletedId)
    for (const line of result.upserts) dirtyBlocksRef.current.delete(line.id)

    enqueueStructuralSave((globalBlocks) => {
      const upserts = result.upserts.map((line) => encodeTextBlock(line))
      if (result.upserts.length === 1 && result.deletes.length === 0) {
        const newId = result.upserts[0].id
        const alreadyExists = globalBlocks.some((block) => block.id === newId)
        if (alreadyExists) return { upserts }

        const targetIndex = globalBlocks.findIndex((block) => block.id === blockId)
        if (targetIndex < 0) return { upserts }
        const order = globalBlocks.map((block) => block.id)
        order.splice(targetIndex + 1, 0, newId)
        return { upserts, order }
      }
      return {
        upserts,
        deletes: result.deletes.length > 0 ? result.deletes : undefined,
      }
    })
    focusLine(result.focusBlockId, result.focusOffset)
  }

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element) || !runtime) return
      const button = target.closest<HTMLButtonElement>('button[data-tool]')
      const format = button?.dataset.tool as EditorTextBlockFormat | undefined
      if (!button || !format || !TEXT_FORMATS.has(format)) return
      const editor = button.closest<HTMLElement>('.oanix-notes')
      if (editor?.dataset.noteId !== runtime.noteId) return
      const selection = readOanixTextLineSelection(runtime.noteId)
      if (!selection || !linesRef.current.some((line) => line.id === selection.blockId)) return
      event.preventDefault()
    }

    const handleFormatClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element) || !runtime) return
      const button = target.closest<HTMLButtonElement>('button[data-tool]')
      const format = button?.dataset.tool as EditorTextBlockFormat | undefined
      if (!button || !format || !TEXT_FORMATS.has(format)) return
      const editor = button.closest<HTMLElement>('.oanix-notes')
      if (editor?.dataset.noteId !== runtime.noteId) return
      const selection = readOanixTextLineSelection(runtime.noteId)
      if (!selection || !linesRef.current.some((line) => line.id === selection.blockId)) return

      event.preventDefault()
      event.stopImmediatePropagation()
      applyFormat(selection.blockId, selection.selectionStart, selection.selectionEnd, format)
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('click', handleFormatClick, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('click', handleFormatClick, true)
    }
  }, [runtime?.noteId])

  const handleInput = (line: EditorTextBlock, value: string, textarea: HTMLTextAreaElement) => {
    let next: EditorTextBlock = { ...line, text: value }
    if (value.trim().length === 0 && next.format !== 'paragraph') {
      next = { ...next, format: 'paragraph' }
    }

    const nextLines = linesRef.current.map((item) => item.id === line.id ? next : item)
    replaceLines(nextLines)
    onActivity()
    const start = textarea.selectionStart ?? value.length
    const end = textarea.selectionEnd ?? start
    rememberSelection(line.id, start, end)
    scheduleTextSave(encodeTextBlock(next))
    resizeLine(line.id)
    keepLineVisible(line.id)
  }

  const handleEnter = (line: EditorTextBlock, textarea: HTMLTextAreaElement) => {
    const result = enterTextLine(
      linesRef.current,
      line.id,
      textarea.selectionStart ?? textarea.value.length,
      textarea.selectionEnd ?? textarea.selectionStart ?? textarea.value.length,
      createTextLineId,
    )
    if (!result) return

    replaceLines(result.lines)
    onActivity()
    dirtyBlocksRef.current.delete(line.id)
    for (const upsert of result.upserts) dirtyBlocksRef.current.delete(upsert.id)

    enqueueStructuralSave((globalBlocks) => {
      const targetIndex = globalBlocks.findIndex((block) => block.id === line.id)
      if (targetIndex < 0) return null
      const order = globalBlocks.map((block) => block.id)
      const insertedId = result.upserts[1]?.id
      if (insertedId) order.splice(targetIndex + 1, 0, insertedId)
      return {
        upserts: result.upserts.map((item) => encodeTextBlock(item)),
        order,
      }
    })
    focusLine(result.focusBlockId, result.focusOffset)
  }

  const handleBoundaryBackspace = (line: EditorTextBlock) => {
    const result = backspaceTextLineBoundary(linesRef.current, line.id)
    if (!result) return false

    replaceLines(result.lines)
    onActivity()
    dirtyBlocksRef.current.delete(line.id)
    for (const deletedId of result.deletes) dirtyBlocksRef.current.delete(deletedId)
    for (const upsert of result.upserts) dirtyBlocksRef.current.delete(upsert.id)

    enqueueStructuralSave((globalBlocks) => {
      if (!globalBlocks.some((block) => block.id === line.id)) return null
      return {
        upserts: result.upserts.map((item) => encodeTextBlock(item)),
        deletes: result.deletes,
        order: globalBlocks.filter((block) => !result.deletes.includes(block.id)).map((block) => block.id),
      }
    })
    focusLine(result.focusBlockId, result.focusOffset)
    return true
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>, line: EditorTextBlock) => {
    if (event.isComposing || composingRef.current || event.altKey || event.ctrlKey || event.metaKey) return

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleEnter(line, event.currentTarget)
      return
    }

    if (event.key !== 'Backspace' || event.shiftKey) return
    const start = event.currentTarget.selectionStart ?? 0
    const end = event.currentTarget.selectionEnd ?? start
    if (start !== 0 || end !== 0) return
    if (handleBoundaryBackspace(line)) event.preventDefault()
  }

  const handlePaste = (event: ReactClipboardEvent<HTMLTextAreaElement>, line: EditorTextBlock) => {
    if (!onPasteImage || disabled) return
    const file = findOanixClipboardImage(event.clipboardData)
    if (!file) return
    event.preventDefault()
    const cursorOffset = Math.max(0, event.currentTarget.selectionStart ?? event.currentTarget.value.length)
    rememberSelection(line.id, cursorOffset, cursorOffset)
    void flushPending().then(() => onPasteImage(file, line.id, cursorOffset))
  }

  return <div className="oanix-text-line-editor" data-oanix-text-lines="true">
    {lines.map((line) => <textarea
      key={line.id}
      ref={(node) => {
        if (node) textareaRefs.current.set(line.id, node)
        else textareaRefs.current.delete(line.id)
      }}
      className="oanix-mixed-document__text oanix-text-line-editor__line"
      data-oanix-mixed-text-id={line.id}
      data-oanix-text-format={line.format ?? 'paragraph'}
      value={line.text}
      readOnly={disabled}
      spellCheck
      autoComplete="off"
      autoCapitalize="sentences"
      aria-label="Renglón de texto de la nota"
      onInput={(event) => {
        if (composingRef.current) return
        handleInput(line, event.currentTarget.value, event.currentTarget)
      }}
      onChange={() => undefined}
      onFocus={(event) => {
        const start = event.currentTarget.selectionStart ?? event.currentTarget.value.length
        const end = event.currentTarget.selectionEnd ?? start
        rememberSelection(line.id, start, end)
        keepLineVisible(line.id)
      }}
      onSelect={(event) => {
        rememberSelection(
          line.id,
          event.currentTarget.selectionStart ?? 0,
          event.currentTarget.selectionEnd ?? event.currentTarget.selectionStart ?? 0,
        )
      }}
      onKeyUp={(event) => {
        rememberSelection(
          line.id,
          event.currentTarget.selectionStart ?? 0,
          event.currentTarget.selectionEnd ?? event.currentTarget.selectionStart ?? 0,
        )
        keepLineVisible(line.id)
      }}
      onPointerUp={(event) => {
        rememberSelection(
          line.id,
          event.currentTarget.selectionStart ?? 0,
          event.currentTarget.selectionEnd ?? event.currentTarget.selectionStart ?? 0,
        )
      }}
      onKeyDown={(event) => handleKeyDown(event, line)}
      onPaste={(event) => handlePaste(event, line)}
      onCompositionStart={() => {
        composingRef.current = true
        onCompositionStart()
      }}
      onCompositionEnd={(event) => {
        composingRef.current = false
        onCompositionEnd()
        handleInput(line, event.currentTarget.value, event.currentTarget)
      }}
    />)}
  </div>
}
