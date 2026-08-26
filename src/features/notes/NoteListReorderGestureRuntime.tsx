import { useEffect } from 'react'
import Sortable from 'sortablejs'
import { persistNoteOrder } from './noteService'
import './noteReorderGesture.css'

const LONG_PRESS_MS = 300
const TOUCH_START_THRESHOLD_PX = 7

type SortableOptionsWithHandle = NonNullable<Parameters<typeof Sortable.create>[1]> & {
  handle: string
}

type DragPoint = {
  x: number
  y: number
}

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

function isExcludedInteractiveTarget(target: HTMLElement): boolean {
  return Boolean(target.closest(
    '.note-row__menu-wrap, button:not(.note-row__open), a, input, textarea, select, [contenteditable="true"]',
  ))
}

function exposeDraggedRowSurface(row: HTMLElement) {
  const root = document.documentElement
  const rect = row.getBoundingClientRect()
  const style = window.getComputedStyle(row)

  root.style.setProperty('--oanix-note-drag-width', `${rect.width}px`)
  root.style.setProperty('--oanix-note-drag-height', `${rect.height}px`)
  root.style.setProperty('--oanix-note-drag-background', style.background)
  root.style.setProperty('--oanix-note-drag-border-color', style.borderColor)
  root.style.setProperty('--oanix-note-drag-border-radius', style.borderRadius)
}

function clearDraggedRowSurface() {
  const root = document.documentElement
  root.style.removeProperty('--oanix-note-drag-width')
  root.style.removeProperty('--oanix-note-drag-height')
  root.style.removeProperty('--oanix-note-drag-background')
  root.style.removeProperty('--oanix-note-drag-border-color')
  root.style.removeProperty('--oanix-note-drag-border-radius')
}

export function NoteListReorderGestureRuntime() {
  useEffect(() => {
    let suppressClickUntil = 0
    let latestDragPoint: DragPoint | null = null
    let dragOverlay: HTMLElement | null = null
    let dragOverlayFrame: number | null = null
    let dragOffsetX = 0
    let dragOffsetY = 0

    const list = document.querySelector<HTMLElement>('.notes-list')
    if (!list?.classList.contains('notes-list')) return

    const noteRows = () => Array.from(
      list.querySelectorAll<HTMLElement>(':scope > .note-row[data-reorder-note-id]'),
    )

    const freezeDragColors = () => {
      noteRows().forEach((row) => {
        const style = window.getComputedStyle(row)
        const color = row.style.getPropertyValue('--oanix-note-card-color').trim()
          || style.getPropertyValue('--oanix-note-card-color').trim()
        if (color) row.style.setProperty('--oanix-note-drag-stable-color', color)
      })
    }

    const clearFrozenDragColors = () => {
      noteRows().forEach((row) => row.style.removeProperty('--oanix-note-drag-stable-color'))
    }

    const positionDragOverlay = () => {
      dragOverlayFrame = null
      if (!dragOverlay || !latestDragPoint) return
      const left = latestDragPoint.x - dragOffsetX
      const top = latestDragPoint.y - dragOffsetY
      dragOverlay.style.transform = `translate3d(${left}px, ${top}px, 0)`
    }

    const scheduleOverlayPosition = () => {
      if (!dragOverlay || dragOverlayFrame !== null) return
      dragOverlayFrame = window.requestAnimationFrame(positionDragOverlay)
    }

    const rememberDragPoint = (point: DragPoint) => {
      latestDragPoint = point
      scheduleOverlayPosition()
    }

    const removeDragOverlay = () => {
      if (dragOverlayFrame !== null) {
        window.cancelAnimationFrame(dragOverlayFrame)
        dragOverlayFrame = null
      }
      dragOverlay?.remove()
      dragOverlay = null
    }

    const createDragOverlay = (row: HTMLElement) => {
      removeDragOverlay()
      const rect = row.getBoundingClientRect()
      const point = latestDragPoint ?? {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }

      dragOffsetX = Math.min(Math.max(point.x - rect.left, 0), rect.width)
      dragOffsetY = Math.min(Math.max(point.y - rect.top, 0), rect.height)

      const overlay = row.cloneNode(true) as HTMLElement
      overlay.removeAttribute('data-reorder-note-id')
      overlay.removeAttribute('data-oanix-note-dragging')
      overlay.classList.remove(
        'oanix-mobile-note-chosen',
        'oanix-mobile-note-placeholder',
        'oanix-mobile-note-drag-source',
        'oanix-mobile-note-drag-ghost',
      )
      overlay.classList.add('oanix-note-drag-overlay')
      overlay.setAttribute('aria-hidden', 'true')
      overlay.querySelectorAll<HTMLElement>('[id]').forEach((element) => element.removeAttribute('id'))
      overlay.style.width = `${rect.width}px`
      overlay.style.height = `${rect.height}px`
      dragOverlay = overlay
      document.body.appendChild(overlay)
      positionDragOverlay()
    }

    const clearDragVisuals = () => {
      document.body.classList.remove('oanix-mobile-note-dragging')
      document.documentElement.classList.remove('oanix-mobile-note-dragging')
      list.querySelectorAll<HTMLElement>('[data-oanix-note-dragging="true"]')
        .forEach((row) => row.removeAttribute('data-oanix-note-dragging'))
      removeDragOverlay()
      clearFrozenDragColors()
      clearDraggedRowSurface()
      window.getSelection()?.removeAllRanges()
    }

    const sortableOptions: SortableOptionsWithHandle = {
      draggable: '.note-row[data-reorder-note-id]',
      handle: '.note-row[data-reorder-note-id]',
      filter: (_event, target) => interactionBlocked() || isExcludedInteractiveTarget(target),
      preventOnFilter: false,
      direction: 'vertical',
      animation: 210,
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
      onChoose: (event) => {
        freezeDragColors()
        event.item.setAttribute('data-oanix-note-dragging', 'true')
        exposeDraggedRowSurface(event.item)
        window.getSelection()?.removeAllRanges()
      },
      onStart: (event) => {
        exposeDraggedRowSurface(event.item)
        createDragOverlay(event.item)
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
        clearDragVisuals()
        const nextOrder = noteOrder(event.to)

        if (event.oldIndex === event.newIndex || nextOrder.length === 0) return

        void (async () => {
          try {
            const updatedNotes = await persistNoteOrder(nextOrder)
            window.dispatchEvent(new CustomEvent('oanix:note-order-persisted', {
              detail: {
                notes: updatedNotes.map((note) => ({
                  id: note.id,
                  manualOrder: note.manualOrder,
                })),
              },
            }))
            window.dispatchEvent(new CustomEvent('oanix:local-data-changed', { detail: { recordType: 'note' } }))
            navigator.vibrate?.(12)
          } catch {
            window.dispatchEvent(new Event('oanix:workspace-refresh'))
          }
        })()
      },
    }

    const sortable = Sortable.create(list, sortableOptions)

    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.note-row[data-reorder-note-id]')) return
      rememberDragPoint({ x: event.clientX, y: event.clientY })
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!dragOverlay) return
      rememberDragPoint({ x: event.clientX, y: event.clientY })
    }

    const onTouchStart = (event: TouchEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.note-row[data-reorder-note-id]')) return
      const touch = event.touches[0]
      if (!touch) return
      rememberDragPoint({ x: touch.clientX, y: touch.clientY })
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!dragOverlay) return
      const touch = event.touches[0]
      if (!touch) return
      rememberDragPoint({ x: touch.clientX, y: touch.clientY })
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

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointermove', onPointerMove, { capture: true, passive: true })
    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: true })
    document.addEventListener('click', onClick, true)
    document.addEventListener('contextmenu', blockNativeLongPress, true)
    document.addEventListener('selectstart', blockNativeLongPress, true)

    return () => {
      sortable.destroy()
      clearDragVisuals()
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointermove', onPointerMove, true)
      document.removeEventListener('touchstart', onTouchStart, true)
      document.removeEventListener('touchmove', onTouchMove, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('contextmenu', blockNativeLongPress, true)
      document.removeEventListener('selectstart', blockNativeLongPress, true)
    }
  }, [])

  return null
}
