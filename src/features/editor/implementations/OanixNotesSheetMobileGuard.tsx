import { useEffect } from 'react'
import type { EditorSurfaceProps } from '../editorSurfaceContract'
import { OanixNotesSheetSurface } from './OanixNotesSheetSurface'
import './oanixNotesSheetMobileSafeArea.css'

const TOP_SAFE_GAP = 18
const BOTTOM_SAFE_GAP = 72
const BODY_MIN_HEIGHT = 280

function isGuardedTextarea(target: EventTarget | null): target is HTMLTextAreaElement {
  return target instanceof HTMLTextAreaElement
    && (target.classList.contains('oanix-notes__body') || target.classList.contains('oanix-mixed-document__text'))
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

export function OanixNotesSheetMobileGuard(props: EditorSurfaceProps) {
  useEffect(() => {
    const editor = document.querySelector<HTMLElement>('.oanix-notes')
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
  }, [])

  return <OanixNotesSheetSurface {...props} />
}
