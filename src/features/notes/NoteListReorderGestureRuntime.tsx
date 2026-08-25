import { useEffect } from 'react'
import Sortable from 'sortablejs'
import { persistNoteOrder } from './noteService'
import './noteReorderGesture.css'

const LONG_PRESS_MS = 300
const TOUCH_START_THRESHOLD_PX = 7

function rowPinned(row: HTMLElement): boolean {
  const title = row.querySelector<HTMLElement>('.note-row__topline > strong')
  return Boolean(title?.textContent?.trim().startsWith('📌'))
}

function noteOrder(list: HTMLElement): string[] {
  return Array.from(list.querySelectorAll<HTMLElement>(':scope > .note-row[data-reorder-note-id]'))
    .flatMap((row) => row.dataset.reorderNoteId ? [row.dataset.reorderNoteId] : [])
}

function interactionBlocked(): boolean {
  return document.documentElement.classList.contains('oanix-note-bulk-selecting')
    || Boolean(document.querySelector('.notes-shell--searching'))
}

function isInteractiveTarget(target: HTMLElement): boolean {
  return Boolean(target.closest('.note-row__menu-wrap, button, a, input, textarea, select, [contenteditable="true"]'))
}

export function NoteListReorderGestureRuntime() {
  useEffect(() => {
    let suppressClickUntil = 0
    let touchArmTimer: number | undefined
    let touchArmed = false
    let touchStartX = 0
    let touchStartY = 0
    const list = document.querySelector<HTMLElement>('.notes-list')
    if (!list?.classList.contains('notes-list')) return

    const clearTouchArm = () => {
      if (touchArmTimer !== undefined) window.clearTimeout(touchArmTimer)
      touchArmTimer = undefined
      touchArmed = false
    }

    const clearDragVisuals = () => {
      document.body.classList.remove('oanix-mobile-note-dragging')
      document.documentElement.classList.remove('oanix-mobile-note-dragging')
      list.querySelectorAll<HTMLElement>('[data-oanix-note-dragging="true"]')
        .forEach((row) => row.removeAttribute('data-oanix-note-dragging'))
      window.getSelection()?.removeAllRanges()
    }

    const sortable = Sortable.create(list, {
      draggable: ':scope > .note-row[data-reorder-note-id]',
      filter: (_event, target) => interactionBlocked() || isInteractiveTarget(target),
      preventOnFilter: false,
      direction: 'vertical',
      animation: 165,
      easing: 'cubic-bezier(.2,.8,.2,1)',
      delay: LONG_PRESS_MS,
      delayOnTouchOnly: true,
      touchStartThreshold: TOUCH_START_THRESHOLD_PX,
      forceFallback: true,
      fallbackOnBody: true,
      fallbackTolerance: 4,
      fallbackClass: 'oanix-mobile-note-drag-ghost',
      chosenClass: 'oanix-mobile-note-chosen',
      ghostClass: 'oanix-mobile-note-placeholder',
      dragClass: 'oanix-mobile-note-drag-source',
      swapThreshold: 0.62,
      invertSwap: false,
      scroll: true,
      scrollSensitivity: 72,
      scrollSpeed: 12,
      bubbleScroll: false,
      dataIdAttr: 'data-reorder-note-id',
      supportPointer: false,
      onChoose: (event) => {
        event.item.setAttribute('data-oanix-note-dragging', 'true')
        window.getSelection()?.removeAllRanges()
      },
      onStart: () => {
        touchArmed = true
        document.body.classList.add('oanix-mobile-note-dragging')
        document.documentElement.classList.add('oanix-mobile-note-dragging')
        navigator.vibrate?.(30)
      },
      onMove: (event) => {
        if (interactionBlocked()) return false
        return rowPinned(event.dragged) === rowPinned(event.related)
      },
      onEnd: (event) => {
        suppressClickUntil = performance.now() + 520
        clearTouchArm()
        clearDragVisuals()
        const nextOrder = noteOrder(event.to)

        if (event.oldIndex === event.newIndex || nextOrder.length === 0) return

        void (async () => {
          try {
            await persistNoteOrder(nextOrder)
            window.dispatchEvent(new CustomEvent('oanix:local-data-changed', { detail: { recordType: 'note' } }))
            window.dispatchEvent(new Event('oanix:workspace-refresh'))
            navigator.vibrate?.(12)
          } catch {
            window.dispatchEvent(new Event('oanix:workspace-refresh'))
          }
        })()
      },
    })

    const onTouchStart = (event: TouchEvent) => {
      clearTouchArm()
      if (event.touches.length !== 1 || interactionBlocked()) return
      if (!(event.target instanceof HTMLElement) || isInteractiveTarget(event.target)) return

      const row = event.target.closest<HTMLElement>('.note-row[data-reorder-note-id]')
      if (!row || row.parentElement !== list) return

      const touch = event.touches[0]
      touchStartX = touch.clientX
      touchStartY = touch.clientY
      touchArmTimer = window.setTimeout(() => {
        touchArmTimer = undefined
        touchArmed = true
      }, LONG_PRESS_MS)
    }

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        clearTouchArm()
        return
      }

      if (touchArmed) {
        event.preventDefault()
        return
      }

      if (touchArmTimer === undefined) return
      const touch = event.touches[0]
      const movedX = touch.clientX - touchStartX
      const movedY = touch.clientY - touchStartY
      if (Math.hypot(movedX, movedY) >= TOUCH_START_THRESHOLD_PX) clearTouchArm()
    }

    const onTouchEnd = () => {
      clearTouchArm()
    }

    const onClick = (event: MouseEvent) => {
      if (performance.now() >= suppressClickUntil) return
      if (!(event.target instanceof Element) || !event.target.closest('.note-row[data-reorder-note-id]')) return
      event.preventDefault()
      event.stopImmediatePropagation()
    }

    const blockNativeLongPress = (event: Event) => {
      if (!(event.target instanceof Element) || !event.target.closest('.note-row[data-reorder-note-id]')) return
      event.preventDefault()
    }

    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false })
    document.addEventListener('touchend', onTouchEnd, true)
    document.addEventListener('touchcancel', onTouchEnd, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('contextmenu', blockNativeLongPress, true)
    document.addEventListener('selectstart', blockNativeLongPress, true)

    return () => {
      sortable.destroy()
      clearTouchArm()
      clearDragVisuals()
      document.removeEventListener('touchstart', onTouchStart, true)
      document.removeEventListener('touchmove', onTouchMove, true)
      document.removeEventListener('touchend', onTouchEnd, true)
      document.removeEventListener('touchcancel', onTouchEnd, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('contextmenu', blockNativeLongPress, true)
      document.removeEventListener('selectstart', blockNativeLongPress, true)
    }
  }, [])

  return null
}
