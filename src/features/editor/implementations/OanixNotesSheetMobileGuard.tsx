import { useEffect, useRef, useState } from 'react'
import type { EditorSurfaceProps } from '../editorSurfaceContract'
import { insertOanixDailyEntryBlock } from '../oanixDailyEntryBlockLayer.ts'
import { applyOanixTextFormat } from '../oanixTextFormatLayer.ts'
import { decodeTextBlock, type EditorTextBlockFormat } from '../textBlockCodec.ts'
import { OanixNotesSheetSurface } from './OanixNotesSheetSurface'
import './oanixNotesSheetMobileSafeArea.css'

const TOP_SAFE_GAP = 18
const BOTTOM_SAFE_GAP = 72
const BODY_MIN_HEIGHT = 280
const ENTRY_SAVE_WAIT_MS = 7_000
const ADD_CONTENT_TOOLS = new Set(['entry', 'image', 'files', 'code', 'checklist', 'contact', 'separator'])
const TEXT_FORMAT_TOOLS = new Set<EditorTextBlockFormat>(['paragraph', 'h2', 'h3', 'quote', 'list', 'numbered-list'])

type MixedCursorTarget = { blockId: string; cursorOffset: number }
type TextSelectionTarget = { blockId: string; selectionStart: number; selectionEnd: number }
type PlainSelection = { selectionStart: number; selectionEnd: number }
type DailyEntryRemoveDetail = { blockId?: string }
type EditorVisualState = { theme: string; modeLabel: string }

function isGuardedTextarea(target: EventTarget | null): target is HTMLTextAreaElement {
  return target instanceof HTMLTextAreaElement
    && (target.classList.contains('oanix-notes__body') || target.classList.contains('oanix-mixed-document__text'))
}

function isSoftKeyboardEditable(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false
  if (target instanceof HTMLTextAreaElement) return true
  if (target instanceof HTMLInputElement) {
    const type = target.type.toLowerCase()
    return !['button', 'checkbox', 'color', 'date', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes(type)
  }
  return target.isContentEditable || target.dataset.editorLocalEditable === 'true'
}

function captureEditorVisualState(editor: HTMLElement): EditorVisualState {
  const activeMode = editor.querySelector<HTMLButtonElement>('.oanix-notes__mode-row button.is-active')
  return {
    theme: editor.dataset.theme || 'default',
    modeLabel: activeMode?.textContent?.trim() ?? '',
  }
}

function restoreEditorVisualState(editor: HTMLElement, visual: EditorVisualState) {
  if (visual.modeLabel) {
    const modeButton = Array.from(editor.querySelectorAll<HTMLButtonElement>('.oanix-notes__mode-row button'))
      .find((button) => button.textContent?.trim() === visual.modeLabel)
    modeButton?.click()
  }
  const preview = editor.querySelector<HTMLElement>(`.oanix-notes__theme-preview.theme-${CSS.escape(visual.theme)}`)
  preview?.closest<HTMLButtonElement>('button')?.click()
}

function numberedMarker(index: number, color: string): string {
  const safeColor = color.replace('#', '%23')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26"><text x="1" y="18" font-size="14" font-family="system-ui,sans-serif" font-weight="700" fill="${safeColor}">${index}.</text></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/%2523/g, '%23')}")`
}

function decorateFormattedTextBlocks(editor: HTMLElement, blocks: Awaited<ReturnType<NonNullable<EditorSurfaceProps['loadBlocks']>>>) {
  const byId = new Map(blocks.map((block) => [block.id, decodeTextBlock(block)]))
  const textareas = Array.from(editor.querySelectorAll<HTMLTextAreaElement>('.oanix-mixed-document__text'))
  let previous: HTMLTextAreaElement | null = null
  let numberedIndex = 0

  for (const textarea of textareas) {
    const blockId = textarea.dataset.oanixMixedTextId
    const block = blockId ? byId.get(blockId) : null
    const format = block?.format ?? 'paragraph'
    textarea.dataset.oanixTextFormat = format
    textarea.style.removeProperty('background-image')
    textarea.style.removeProperty('background-repeat')
    textarea.style.removeProperty('background-position')
    textarea.style.removeProperty('background-size')

    if (format === 'numbered-list') {
      const contiguous = previous?.nextElementSibling === textarea && previous.dataset.oanixTextFormat === 'numbered-list'
      numberedIndex = contiguous ? numberedIndex + 1 : 1
      const color = window.getComputedStyle(textarea).color || '#64748b'
      textarea.style.backgroundImage = numberedMarker(numberedIndex, color)
      textarea.style.backgroundRepeat = 'no-repeat'
      textarea.style.backgroundPosition = '2px 5px'
      textarea.style.backgroundSize = '26px 26px'
    } else {
      numberedIndex = 0
    }
    previous = textarea
  }
}

function getCaretTop(textarea: HTMLTextAreaElement): number {
  const style = window.getComputedStyle(textarea)
  const mirror = document.createElement('div')

  mirror.style.position = 'fixed'
  mirror.style.left = '-10000px'
  mirror.style.top = '0'
  mirror.style.visibility = 'hidden'
  mirror.style.pointerEvents = 'none'
  mirror.style.boxSizing = style.boxSizing
  mirror.style.width = `${textarea.getBoundingClientRect().width}px`
  mirror.style.paddingTop = style.paddingTop
  mirror.style.paddingRight = style.paddingRight
  mirror.style.paddingBottom = style.paddingBottom
  mirror.style.paddingLeft = style.paddingLeft
  mirror.style.borderTopWidth = style.borderTopWidth
  mirror.style.borderRightWidth = style.borderRightWidth
  mirror.style.borderBottomWidth = style.borderBottomWidth
  mirror.style.borderLeftWidth = style.borderLeftWidth
  mirror.style.fontFamily = style.fontFamily
  mirror.style.fontSize = style.fontSize
  mirror.style.fontWeight = style.fontWeight
  mirror.style.fontStyle = style.fontStyle
  mirror.style.letterSpacing = style.letterSpacing
  mirror.style.lineHeight = style.lineHeight
  mirror.style.textTransform = style.textTransform
  mirror.style.textIndent = style.textIndent
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.overflowWrap = 'anywhere'
  mirror.style.wordBreak = style.wordBreak

  const caret = Math.max(0, textarea.selectionStart ?? textarea.value.length)
  mirror.textContent = textarea.value.slice(0, caret)
  const marker = document.createElement('span')
  marker.textContent = '\u200b'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)

  const top = marker.offsetTop
  mirror.remove()
  return top
}

function keepCaretInVisibleZone(textarea: HTMLTextAreaElement, allowUpwardCorrection = false) {
  const scroller = textarea.closest<HTMLElement>('.oanix-notes')?.querySelector<HTMLElement>('.oanix-notes__editor-container')
  if (!scroller || document.activeElement !== textarea) return

  const viewport = window.visualViewport
  const viewportTop = viewport?.offsetTop ?? 0
  const viewportHeight = viewport?.height ?? window.innerHeight
  const textareaRect = textarea.getBoundingClientRect()
  const style = window.getComputedStyle(textarea)
  const lineHeight = Number.parseFloat(style.lineHeight) || 27
  const caretTop = textareaRect.top + getCaretTop(textarea) - textarea.scrollTop
  const caretBottom = caretTop + lineHeight

  const safeTop = viewportTop + 56 + TOP_SAFE_GAP
  const safeBottom = viewportTop + viewportHeight - BOTTOM_SAFE_GAP

  if (caretBottom > safeBottom) {
    scroller.scrollTop += caretBottom - safeBottom
  } else if (allowUpwardCorrection && caretTop < safeTop) {
    scroller.scrollTop = Math.max(0, scroller.scrollTop - (safeTop - caretTop))
  }
}

function scheduleCaretCheck(textarea: HTMLTextAreaElement, allowUpwardCorrection = false) {
  window.requestAnimationFrame(() =>
    window.requestAnimationFrame(() => keepCaretInVisibleZone(textarea, allowUpwardCorrection)),
  )
}

function freezePlainBodyHeight(textarea: HTMLTextAreaElement, deleting = false) {
  if (!textarea.classList.contains('oanix-notes__body')) return
  if (deleting) {
    textarea.style.minHeight = `${BODY_MIN_HEIGHT}px`
    return
  }
  const currentHeight = Math.max(BODY_MIN_HEIGHT, textarea.getBoundingClientRect().height)
  textarea.style.minHeight = `${currentHeight}px`
}

function waitForEditorClean(editor: HTMLElement): Promise<boolean> {
  if (editor.dataset.unsaved !== 'true') return Promise.resolve(true)

  return new Promise((resolve) => {
    let settled = false
    const finish = (value: boolean) => {
      if (settled) return
      settled = true
      observer.disconnect()
      window.clearTimeout(timeoutId)
      resolve(value)
    }
    const observer = new MutationObserver(() => {
      if (editor.dataset.unsaved !== 'true') finish(true)
    })
    observer.observe(editor, { attributes: true, attributeFilter: ['data-unsaved'] })
    const timeoutId = window.setTimeout(() => finish(editor.dataset.unsaved !== 'true'), ENTRY_SAVE_WAIT_MS)
  })
}

export function OanixNotesSheetMobileGuard(props: EditorSurfaceProps) {
  const [surfaceRevision, setSurfaceRevision] = useState(0)
  const [entryBusy, setEntryBusy] = useState(false)
  const [entryError, setEntryError] = useState('')
  const entryBusyRef = useRef(false)
  const lastPlainCursorRef = useRef<number | null>(null)
  const lastMixedCursorRef = useRef<MixedCursorTarget | null>(null)
  const lastPlainSelectionRef = useRef<PlainSelection | null>(null)
  const lastMixedSelectionRef = useRef<TextSelectionTarget | null>(null)
  const pendingEntryRevealRef = useRef<string | null>(null)
  const pendingVisualStateRef = useRef<EditorVisualState | null>(null)
  const suppressToolKeyboardRef = useRef(false)

  useEffect(() => {
    const editor = document.querySelector<HTMLElement>(`.oanix-notes[data-note-id="${CSS.escape(props.noteId)}"]`)
    const viewport = window.visualViewport
    if (!editor) return

    const activeGuardedTextarea = () => {
      const active = document.activeElement
      return isGuardedTextarea(active) && editor.contains(active) ? active : null
    }

    const syncViewport = () => {
      const viewportTop = viewport?.offsetTop ?? 0
      const viewportHeight = viewport?.height ?? window.innerHeight
      const viewportBottomInset = Math.max(0, window.innerHeight - (viewportTop + viewportHeight))

      editor.style.setProperty('--oanix-viewport-top', `${viewportTop}px`)
      editor.style.setProperty('--oanix-visible-height', `${viewportHeight}px`)
      editor.style.setProperty('--oanix-viewport-bottom-inset', `${viewportBottomInset}px`)
      const textarea = activeGuardedTextarea()
      if (textarea) scheduleCaretCheck(textarea, false)
    }

    const handleBeforeInput = (event: InputEvent) => {
      if (!isGuardedTextarea(event.target) || !editor.contains(event.target)) return
      freezePlainBodyHeight(event.target, event.inputType.startsWith('delete'))
    }

    const handleTyping = (event: Event) => {
      if (!isGuardedTextarea(event.target) || !editor.contains(event.target)) return
      freezePlainBodyHeight(event.target)
      scheduleCaretCheck(event.target, false)
    }

    const handlePointerSelection = (event: Event) => {
      if (!isGuardedTextarea(event.target) || !editor.contains(event.target)) return
      scheduleCaretCheck(event.target, true)
    }

    const handleFocus = (event: FocusEvent) => {
      if (!isGuardedTextarea(event.target) || !editor.contains(event.target)) return
      freezePlainBodyHeight(event.target)
      const textarea = event.target
      window.setTimeout(() => scheduleCaretCheck(textarea, false), 60)
      window.setTimeout(() => scheduleCaretCheck(textarea, false), 220)
    }

    editor.addEventListener('beforeinput', handleBeforeInput as EventListener)
    editor.addEventListener('input', handleTyping)
    editor.addEventListener('keyup', handleTyping)
    editor.addEventListener('pointerup', handlePointerSelection)
    editor.addEventListener('focusin', handleFocus)
    viewport?.addEventListener('resize', syncViewport)
    viewport?.addEventListener('scroll', syncViewport)
    syncViewport()

    return () => {
      editor.removeEventListener('beforeinput', handleBeforeInput as EventListener)
      editor.removeEventListener('input', handleTyping)
      editor.removeEventListener('keyup', handleTyping)
      editor.removeEventListener('pointerup', handlePointerSelection)
      editor.removeEventListener('focusin', handleFocus)
      viewport?.removeEventListener('resize', syncViewport)
      viewport?.removeEventListener('scroll', syncViewport)
    }
  }, [props.noteId, surfaceRevision])

  useEffect(() => {
    const findEditor = () => document.querySelector<HTMLElement>(`.oanix-notes[data-note-id="${CSS.escape(props.noteId)}"]`)

    const rememberCursor = (event: Event) => {
      const target = event.target
      if (!(target instanceof HTMLTextAreaElement)) return
      const editor = findEditor()
      if (!editor || !editor.contains(target)) return
      const selectionStart = Math.max(0, target.selectionStart ?? target.value.length)
      const selectionEnd = Math.max(selectionStart, target.selectionEnd ?? selectionStart)

      if (target.classList.contains('oanix-notes__body')) {
        lastPlainCursorRef.current = selectionStart
        lastPlainSelectionRef.current = { selectionStart, selectionEnd }
        return
      }
      if (!target.classList.contains('oanix-mixed-document__text')) return
      const blockId = target.dataset.oanixMixedTextId
      if (!blockId) return
      lastMixedCursorRef.current = { blockId, cursorOffset: selectionStart }
      lastMixedSelectionRef.current = { blockId, selectionStart, selectionEnd }
    }

    const insertEntry = async () => {
      if (entryBusyRef.current) return
      const editor = findEditor()
      if (!editor || !props.loadBlocks || !props.onRequestBlockSave) {
        setEntryError('Entrada todavía no está disponible en el estado actual de esta nota.')
        return
      }

      entryBusyRef.current = true
      setEntryBusy(true)
      setEntryError('')
      try {
        const clean = await waitForEditorClean(editor)
        if (!clean) {
          setEntryError('No se pudo guardar el contenido pendiente antes de insertar la entrada.')
          return
        }

        const mode = editor.dataset.documentMode
        const existingBlocks = await props.loadBlocks()
        if (mode === 'plain') {
          const body = editor.querySelector<HTMLTextAreaElement>('.oanix-notes__body')
          const title = editor.querySelector<HTMLInputElement>('.oanix-notes__title')
          if (!body) {
            setEntryError('No se encontró el punto de inserción de la entrada.')
            return
          }
          const cursorOffset = Math.min(
            Math.max(0, lastPlainCursorRef.current ?? body.selectionStart ?? body.value.length),
            body.value.length,
          )
          const result = await insertOanixDailyEntryBlock({
            mode: 'plain',
            title: title?.value ?? props.initialTitle,
            text: body.value,
            cursorOffset,
            existingBlocks,
            saveBlockChanges: props.onRequestBlockSave,
            savePlainSnapshot: props.onRequestSave,
          })
          if (result.status !== 'committed') {
            setEntryError(`No se pudo insertar la entrada de forma segura (${result.status}).`)
            return
          }
          pendingEntryRevealRef.current = result.plan.dailyEntryBlockId
        } else {
          let target = lastMixedCursorRef.current
          if (!target) {
            const textareas = editor.querySelectorAll<HTMLTextAreaElement>('.oanix-mixed-document__text')
            const fallback = textareas.item(Math.max(0, textareas.length - 1))
            const blockId = fallback?.dataset.oanixMixedTextId
            if (fallback && blockId) target = { blockId, cursorOffset: fallback.value.length }
          }
          if (!target) {
            setEntryError('Coloca el cursor en un tramo de texto antes de insertar la entrada.')
            return
          }
          const result = await insertOanixDailyEntryBlock({
            mode: 'mixed',
            blocks: existingBlocks,
            targetTextBlockId: target.blockId,
            cursorOffset: target.cursorOffset,
            saveBlockChanges: props.onRequestBlockSave,
          })
          if (result.status !== 'committed') {
            setEntryError(`No se pudo insertar la entrada de forma segura (${result.status}).`)
            return
          }
          pendingEntryRevealRef.current = result.plan.dailyEntryBlockId
        }

        pendingVisualStateRef.current = captureEditorVisualState(editor)
        props.onActivity?.()
        lastMixedCursorRef.current = null
        lastPlainCursorRef.current = null
        lastMixedSelectionRef.current = null
        lastPlainSelectionRef.current = null
        setSurfaceRevision((revision) => revision + 1)
      } catch {
        setEntryError('No se pudo insertar la entrada de forma segura.')
      } finally {
        entryBusyRef.current = false
        setEntryBusy(false)
      }
    }

    const applyTextFormat = async (format: EditorTextBlockFormat) => {
      if (entryBusyRef.current) return
      const editor = findEditor()
      if (!editor || !props.loadBlocks || !props.onRequestBlockSave) {
        setEntryError('El formato de texto todavía no está disponible en el estado actual de esta nota.')
        return
      }

      entryBusyRef.current = true
      setEntryBusy(true)
      setEntryError('')
      try {
        const clean = await waitForEditorClean(editor)
        if (!clean) {
          setEntryError('No se pudo guardar el contenido pendiente antes de aplicar el formato.')
          return
        }

        const blocks = await props.loadBlocks()
        if (editor.dataset.documentMode === 'plain') {
          const body = editor.querySelector<HTMLTextAreaElement>('.oanix-notes__body')
          const title = editor.querySelector<HTMLInputElement>('.oanix-notes__title')
          if (!body) {
            setEntryError('No se encontró el texto que quieres formatear.')
            return
          }
          const selection = lastPlainSelectionRef.current ?? {
            selectionStart: body.selectionStart ?? body.value.length,
            selectionEnd: body.selectionEnd ?? body.selectionStart ?? body.value.length,
          }
          const result = await applyOanixTextFormat({
            mode: 'plain',
            format,
            title: title?.value ?? props.initialTitle,
            text: body.value,
            selectionStart: selection.selectionStart,
            selectionEnd: selection.selectionEnd,
            existingBlocks: blocks,
            saveBlockChanges: props.onRequestBlockSave,
            savePlainSnapshot: props.onRequestSave,
          })
          if (result.status !== 'committed') {
            setEntryError(`No se pudo aplicar el formato de forma segura (${result.status}).`)
            return
          }
        } else {
          let selection = lastMixedSelectionRef.current
          if (!selection) {
            const textareas = editor.querySelectorAll<HTMLTextAreaElement>('.oanix-mixed-document__text')
            const fallback = textareas.item(Math.max(0, textareas.length - 1))
            const blockId = fallback?.dataset.oanixMixedTextId
            if (fallback && blockId) {
              selection = { blockId, selectionStart: fallback.value.length, selectionEnd: fallback.value.length }
            }
          }
          if (!selection) {
            setEntryError('Coloca el cursor o selecciona texto antes de aplicar el formato.')
            return
          }
          const result = await applyOanixTextFormat({
            mode: 'mixed',
            format,
            blocks,
            targetTextBlockId: selection.blockId,
            selectionStart: selection.selectionStart,
            selectionEnd: selection.selectionEnd,
            saveBlockChanges: props.onRequestBlockSave,
          })
          if (result.status !== 'committed') {
            setEntryError(`No se pudo aplicar el formato de forma segura (${result.status}).`)
            return
          }
        }

        pendingVisualStateRef.current = captureEditorVisualState(editor)
        props.onActivity?.()
        lastMixedCursorRef.current = null
        lastPlainCursorRef.current = null
        lastMixedSelectionRef.current = null
        lastPlainSelectionRef.current = null
        setSurfaceRevision((revision) => revision + 1)
      } catch {
        setEntryError('No se pudo aplicar el formato de texto de forma segura.')
      } finally {
        entryBusyRef.current = false
        setEntryBusy(false)
      }
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const button = target.closest<HTMLButtonElement>('button[data-tool]')
      const editor = findEditor()
      if (!button || !editor || !editor.contains(button) || button.disabled) return
      const tool = button.dataset.tool ?? ''
      if (tool === 'entry') {
        void insertEntry()
        return
      }
      if (TEXT_FORMAT_TOOLS.has(tool as EditorTextBlockFormat)) {
        void applyTextFormat(tool as EditorTextBlockFormat)
      }
    }

    document.addEventListener('focusin', rememberCursor, true)
    document.addEventListener('input', rememberCursor, true)
    document.addEventListener('select', rememberCursor, true)
    document.addEventListener('keyup', rememberCursor, true)
    document.addEventListener('pointerup', rememberCursor, true)
    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('focusin', rememberCursor, true)
      document.removeEventListener('input', rememberCursor, true)
      document.removeEventListener('select', rememberCursor, true)
      document.removeEventListener('keyup', rememberCursor, true)
      document.removeEventListener('pointerup', rememberCursor, true)
      document.removeEventListener('click', handleClick)
    }
  }, [props])

  useEffect(() => {
    const handleDailyEntryRemove = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const blockId = (event.detail as DailyEntryRemoveDetail | null)?.blockId
      if (!blockId || entryBusyRef.current || !props.loadBlocks || !props.onRequestBlockSave) return

      const editor = document.querySelector<HTMLElement>(`.oanix-notes[data-note-id="${CSS.escape(props.noteId)}"]`)
      const entry = editor?.querySelector<HTMLElement>(`[data-oanix-element-id="${CSS.escape(blockId)}"][data-oanix-element-kind="dailyEntry"]`)
      if (!editor || !entry) return

      void (async () => {
        entryBusyRef.current = true
        setEntryBusy(true)
        setEntryError('')
        try {
          const clean = await waitForEditorClean(editor)
          if (!clean) {
            setEntryError('No se pudo guardar el contenido pendiente antes de eliminar la entrada.')
            return
          }

          const blocks = await props.loadBlocks!()
          if (!blocks.some((block) => block.id === blockId && block.kind === 'dailyEntry')) {
            setEntryError('La entrada ya no está disponible.')
            return
          }
          const nextBlocks = blocks.filter((block) => block.id !== blockId)
          const removed = await props.onRequestBlockSave!({
            deletes: [blockId],
            order: nextBlocks.map((block) => block.id),
          })
          if (!removed) {
            setEntryError('No se pudo eliminar la entrada.')
            return
          }

          pendingVisualStateRef.current = captureEditorVisualState(editor)
          props.onActivity?.()
          lastMixedCursorRef.current = null
          lastPlainCursorRef.current = null
          lastMixedSelectionRef.current = null
          lastPlainSelectionRef.current = null
          setSurfaceRevision((revision) => revision + 1)
        } catch {
          setEntryError('No se pudo eliminar la entrada.')
        } finally {
          entryBusyRef.current = false
          setEntryBusy(false)
        }
      })()
    }

    window.addEventListener('oanix-daily-entry-remove', handleDailyEntryRemove)
    return () => window.removeEventListener('oanix-daily-entry-remove', handleDailyEntryRemove)
  }, [props])

  useEffect(() => {
    const findEditor = () => document.querySelector<HTMLElement>(`.oanix-notes[data-note-id="${CSS.escape(props.noteId)}"]`)

    const handleToolClickCapture = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const button = target.closest<HTMLButtonElement>('button[data-tool]')
      const tool = button?.dataset.tool ?? ''
      const editor = findEditor()
      if (!button || !ADD_CONTENT_TOOLS.has(tool) || !editor || !editor.contains(button) || button.disabled) return

      suppressToolKeyboardRef.current = true
      const active = document.activeElement
      if (isSoftKeyboardEditable(active) && editor.contains(active)) active.blur()
    }

    const handlePointerDownCapture = (event: PointerEvent) => {
      if (!suppressToolKeyboardRef.current || !isSoftKeyboardEditable(event.target)) return
      const editor = findEditor()
      if (editor?.contains(event.target)) suppressToolKeyboardRef.current = false
    }

    const handleKeyDownCapture = (event: KeyboardEvent) => {
      if (!suppressToolKeyboardRef.current || (event.key !== 'Tab' && event.key !== 'Enter')) return
      const editor = findEditor()
      if (editor?.contains(event.target as Node)) suppressToolKeyboardRef.current = false
    }

    const handleFocusInCapture = (event: FocusEvent) => {
      if (!suppressToolKeyboardRef.current || !isSoftKeyboardEditable(event.target)) return
      const editor = findEditor()
      if (!editor || !editor.contains(event.target)) return
      event.target.blur()
    }

    document.addEventListener('click', handleToolClickCapture, true)
    document.addEventListener('pointerdown', handlePointerDownCapture, true)
    document.addEventListener('keydown', handleKeyDownCapture, true)
    document.addEventListener('focusin', handleFocusInCapture, true)
    return () => {
      document.removeEventListener('click', handleToolClickCapture, true)
      document.removeEventListener('pointerdown', handlePointerDownCapture, true)
      document.removeEventListener('keydown', handleKeyDownCapture, true)
      document.removeEventListener('focusin', handleFocusInCapture, true)
    }
  }, [props.noteId])

  useEffect(() => {
    if (!props.loadBlocks) return
    const editor = document.querySelector<HTMLElement>(`.oanix-notes[data-note-id="${CSS.escape(props.noteId)}"]`)
    if (!editor) return
    let active = true
    let refreshTicket = 0

    const refresh = () => {
      const ticket = ++refreshTicket
      void props.loadBlocks!().then((blocks) => {
        if (!active || ticket !== refreshTicket) return
        decorateFormattedTextBlocks(editor, blocks)
      }).catch(() => undefined)
    }

    const observer = new MutationObserver((records) => {
      if (records.some((record) => record.type === 'childList')) refresh()
    })
    observer.observe(editor, { childList: true, subtree: true })
    refresh()
    return () => {
      active = false
      observer.disconnect()
    }
  }, [props.loadBlocks, props.noteId, surfaceRevision])

  useEffect(() => {
    const visual = pendingVisualStateRef.current
    if (!visual) return
    pendingVisualStateRef.current = null
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const editor = document.querySelector<HTMLElement>(`.oanix-notes[data-note-id="${CSS.escape(props.noteId)}"]`)
      if (editor) restoreEditorVisualState(editor, visual)
    }))
  }, [props.noteId, surfaceRevision])

  useEffect(() => {
    const blockId = pendingEntryRevealRef.current
    if (!blockId) return
    pendingEntryRevealRef.current = null
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const editor = document.querySelector<HTMLElement>(`.oanix-notes[data-note-id="${CSS.escape(props.noteId)}"]`)
      const entry = editor?.querySelector<HTMLElement>(`[data-oanix-element-id="${CSS.escape(blockId)}"]`)
      entry?.scrollIntoView({ block: 'center' })
    }))
  }, [props.noteId, surfaceRevision])

  return <OanixNotesSheetSurface
    key={surfaceRevision}
    {...props}
    saving={props.saving || entryBusy}
    error={entryError || props.error}
  />
}
