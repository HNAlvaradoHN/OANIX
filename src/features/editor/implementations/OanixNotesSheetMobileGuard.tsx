import { useEffect } from 'react'
import type { EditorSurfaceProps } from '../editorSurfaceContract'
import { OanixNotesSheetSurface } from './OanixNotesSheetSurface'
import './oanixNotesSheetMobileSafeArea.css'

const TOP_SAFE_GAP = 18
const BOTTOM_SAFE_GAP = 72

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

function keepCaretInVisibleZone() {
  const textarea = document.querySelector<HTMLTextAreaElement>('.oanix-notes__body')
  const scroller = document.querySelector<HTMLElement>('.oanix-notes__editor-container')
  if (!textarea || !scroller || document.activeElement !== textarea) return

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
  } else if (caretTop < safeTop) {
    scroller.scrollTop = Math.max(0, scroller.scrollTop - (safeTop - caretTop))
  }
}

function scheduleCaretCheck() {
  window.requestAnimationFrame(() => window.requestAnimationFrame(keepCaretInVisibleZone))
}

export function OanixNotesSheetMobileGuard(props: EditorSurfaceProps) {
  useEffect(() => {
    const editor = document.querySelector<HTMLElement>('.oanix-notes')
    const textarea = document.querySelector<HTMLTextAreaElement>('.oanix-notes__body')
    const viewport = window.visualViewport
    if (!editor || !textarea) return

    const syncViewport = () => {
      const viewportTop = viewport?.offsetTop ?? 0
      const viewportHeight = viewport?.height ?? window.innerHeight
      const viewportBottomInset = Math.max(0, window.innerHeight - (viewportTop + viewportHeight))

      editor.style.setProperty('--oanix-viewport-top', `${viewportTop}px`)
      editor.style.setProperty('--oanix-visible-height', `${viewportHeight}px`)
      editor.style.setProperty('--oanix-viewport-bottom-inset', `${viewportBottomInset}px`)
      scheduleCaretCheck()
    }

    const handleInputOrSelection = () => scheduleCaretCheck()
    const handleFocus = () => {
      window.setTimeout(scheduleCaretCheck, 60)
      window.setTimeout(scheduleCaretCheck, 220)
    }

    textarea.addEventListener('input', handleInputOrSelection)
    textarea.addEventListener('select', handleInputOrSelection)
    textarea.addEventListener('keyup', handleInputOrSelection)
    textarea.addEventListener('pointerup', handleInputOrSelection)
    textarea.addEventListener('focus', handleFocus)
    viewport?.addEventListener('resize', syncViewport)
    viewport?.addEventListener('scroll', syncViewport)
    syncViewport()

    return () => {
      textarea.removeEventListener('input', handleInputOrSelection)
      textarea.removeEventListener('select', handleInputOrSelection)
      textarea.removeEventListener('keyup', handleInputOrSelection)
      textarea.removeEventListener('pointerup', handleInputOrSelection)
      textarea.removeEventListener('focus', handleFocus)
      viewport?.removeEventListener('resize', syncViewport)
      viewport?.removeEventListener('scroll', syncViewport)
    }
  }, [])

  return <OanixNotesSheetSurface {...props} />
}