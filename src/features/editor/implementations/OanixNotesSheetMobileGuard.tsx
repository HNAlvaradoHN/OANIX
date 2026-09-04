import { useEffect, useRef, useState } from 'react'
import type { EditorSurfaceProps } from '../editorSurfaceContract'
import { insertOanixDailyEntryBlock } from '../oanixDailyEntryBlockLayer.ts'
import { OanixNotesSheetSurface } from './OanixNotesSheetSurface'
import './oanixNotesSheetMobileSafeArea.css'

const TOP_SAFE_GAP = 18
const BOTTOM_SAFE_GAP = 72
const BODY_MIN_HEIGHT = 280
const ENTRY_SAVE_WAIT_MS = 7_000
const ADD_CONTENT_TOOLS = new Set(['entry', 'image', 'files', 'code', 'checklist', 'contact', 'separator'])

type MixedCursorTarget = { blockId: string; cursorOffset: number }

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
  const pendingEntryRevealRef = useRef<string | null>(null)
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

    // The approved plain body briefly assigns height:auto while measuring. Freeze only
    // that textarea at its reached height so normal typing never flashes it smaller.
    // Mixed text segments already own a compact local autosize contract and must not
    // inherit the 280px minimum of the continuous body.
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

      if (target.classList.contains('oanix-notes__body')) {
        lastPlainCursorRef.current = Math.max(0, target.selectionStart ?? target.value.length)
        return
      }
      if (!target.classList.contains('oanix-mixed-document__text')) return
      const blockId = target.dataset.oanixMixedTextId
      if (!blockId) return
      lastMixedCursorRef.current = {
        blockId,
        cursorOffset: Math.max(0, target.selectionStart ?? target.value.length),
      }
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

        props.onActivity?.()
        lastMixedCursorRef.current = null
        lastPlainCursorRef.current = null
        setSurfaceRevision((revision) => revision + 1)
      } catch {
        setEntryError('No se pudo insertar la entrada de forma segura.')
      } finally {
        entryBusyRef.current = false
        setEntryBusy(false)
      }
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const button = target.closest<HTMLButtonElement>('button[data-tool="entry"]')
      const editor = findEditor()
      if (!button || !editor || !editor.contains(button) || button.disabled) return
      void insertEntry()
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
