import { useEffect } from 'react'
import './tagMobileGesture.css'

const SWIPE_START_PX = 7
const REORDER_EDGE_PX = 44
const REORDER_SCROLL_STEP_PX = 12

interface ActiveSwipe {
  pointerId: number
  tagId: string
  startX: number
  startY: number
  startScrollLeft: number
  scrolling: boolean
}

function tagIdFromTarget(target: Element): string {
  return target.closest<HTMLElement>('[data-oanix-organic-tag-id]')?.dataset.oanixOrganicTagId?.trim() ?? ''
}

export function TagMobileGestureRuntime() {
  useEffect(() => {
    let active: ActiveSwipe | null = null
    let suppressClickForId = ''
    let dragOverlay: HTMLElement | null = null
    let dragOffsetX = 0
    let dragOffsetY = 0

    function removeDragOverlay() {
      dragOverlay?.remove()
      dragOverlay = null
      document.documentElement.classList.remove('oanix-tag-drag-overlay-active')
    }

    function ensureDragOverlay(event: PointerEvent) {
      const source = document.querySelector<HTMLElement>(
        '.oanix-organic-tags.is-reordering .oanix-organic-tag-chip.is-dragging[data-oanix-organic-tag-id]',
      )
      if (!source) {
        removeDragOverlay()
        return
      }

      if (!dragOverlay) {
        const rect = source.getBoundingClientRect()
        dragOffsetX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width)
        dragOffsetY = Math.min(Math.max(event.clientY - rect.top, 0), rect.height)
        dragOverlay = source.cloneNode(true) as HTMLElement
        dragOverlay.classList.remove('is-dragging', 'is-active')
        dragOverlay.classList.add('oanix-tag-drag-overlay')
        dragOverlay.removeAttribute('data-oanix-organic-tag-id')
        dragOverlay.setAttribute('aria-hidden', 'true')
        dragOverlay.style.width = `${rect.width}px`
        dragOverlay.style.height = `${rect.height}px`
        document.body.appendChild(dragOverlay)
        document.documentElement.classList.add('oanix-tag-drag-overlay-active')
      }

      dragOverlay.style.left = `${event.clientX - dragOffsetX}px`
      dragOverlay.style.top = `${event.clientY - dragOffsetY}px`
    }

    function autoScrollDuringReorder(scroller: HTMLElement, pointerX: number) {
      const rect = scroller.getBoundingClientRect()
      if (pointerX < rect.left + REORDER_EDGE_PX) {
        scroller.scrollLeft -= REORDER_SCROLL_STEP_PX
      } else if (pointerX > rect.right - REORDER_EDGE_PX) {
        scroller.scrollLeft += REORDER_SCROLL_STEP_PX
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      const target = event.target
      if (!(target instanceof Element)) return
      const chip = target.closest<HTMLElement>('.oanix-organic-tag-chip[data-oanix-organic-tag-id]')
      const scroller = chip?.closest<HTMLElement>('.oanix-organic-tags__scroll')
      const tagId = chip ? tagIdFromTarget(chip) : ''
      if (!chip || !scroller || !tagId) return

      active = {
        pointerId: event.pointerId,
        tagId,
        startX: event.clientX,
        startY: event.clientY,
        startScrollLeft: scroller.scrollLeft,
        scrolling: false,
      }
    }

    function handlePointerMove(event: PointerEvent) {
      if (!active || active.pointerId !== event.pointerId) return
      const target = event.target
      if (!(target instanceof Element)) return
      const scroller = document.querySelector<HTMLElement>('.oanix-organic-tags__scroll')
      if (!scroller) return

      if (document.querySelector('.oanix-organic-tags.is-reordering')) {
        active.scrolling = false
        suppressClickForId = active.tagId
        ensureDragOverlay(event)
        autoScrollDuringReorder(scroller, event.clientX)
        return
      }

      removeDragOverlay()
      const dx = event.clientX - active.startX
      const dy = event.clientY - active.startY
      if (!active.scrolling) {
        if (Math.abs(dx) < SWIPE_START_PX) return
        if (Math.abs(dx) <= Math.abs(dy)) return
        active.scrolling = true
      }

      event.preventDefault()
      scroller.scrollLeft = active.startScrollLeft - dx
      suppressClickForId = active.tagId
    }

    function clearPointer(event: PointerEvent) {
      if (!active || active.pointerId !== event.pointerId) return
      active = null
      removeDragOverlay()
    }

    function handleClick(event: MouseEvent) {
      if (!suppressClickForId) return
      const target = event.target
      if (!(target instanceof Element)) return
      const tagId = tagIdFromTarget(target)
      if (!tagId || tagId !== suppressClickForId) return
      event.preventDefault()
      event.stopImmediatePropagation()
      suppressClickForId = ''
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('pointermove', handlePointerMove, { capture: true, passive: false })
    document.addEventListener('pointerup', clearPointer, true)
    document.addEventListener('pointercancel', clearPointer, true)
    document.addEventListener('click', handleClick, true)

    return () => {
      active = null
      removeDragOverlay()
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerup', clearPointer, true)
      document.removeEventListener('pointercancel', clearPointer, true)
      document.removeEventListener('click', handleClick, true)
    }
  }, [])

  return null
}
