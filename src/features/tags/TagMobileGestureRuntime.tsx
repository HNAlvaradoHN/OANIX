import { useEffect } from 'react'
import './tagMobileGesture.css'

const SWIPE_START_PX = 7
const REORDER_EDGE_PX = 64
const REORDER_MAX_SCROLL_PX = 3
const REORDER_RIGHT_GUARD_PX = 8
const REORDER_SLOT_TICK_MS = 85

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
    let autoScrollFrame: number | null = null
    let latestReorderPointerX = 0
    let lastEdgeSlotTickAt = 0

    function removeDragOverlay() {
      dragOverlay?.remove()
      dragOverlay = null
      document.documentElement.classList.remove('oanix-tag-drag-overlay-active')
    }

    function resetActiveGesture() {
      active = null
      if (autoScrollFrame !== null) {
        window.cancelAnimationFrame(autoScrollFrame)
        autoScrollFrame = null
      }
      removeDragOverlay()
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

      const controlsLeft = document.querySelector<HTMLElement>('.oanix-organic-tags__controls')
        ?.getBoundingClientRect().left ?? window.innerWidth
      const overlayWidth = dragOverlay.getBoundingClientRect().width
      const clampedLeft = Math.min(
        event.clientX - dragOffsetX,
        controlsLeft - REORDER_RIGHT_GUARD_PX - overlayWidth,
      )
      dragOverlay.style.left = `${clampedLeft}px`
      dragOverlay.style.top = `${event.clientY - dragOffsetY}px`
    }

    function scheduleAutoScrollDuringReorder(scroller: HTMLElement, pointerX: number) {
      const controlsLeft = document.querySelector<HTMLElement>('.oanix-organic-tags__controls')
        ?.getBoundingClientRect().left ?? scroller.getBoundingClientRect().right
      latestReorderPointerX = Math.min(pointerX, controlsLeft - REORDER_RIGHT_GUARD_PX)
      if (autoScrollFrame !== null) return

      const tick = (now: number) => {
        autoScrollFrame = null
        if (!active || !document.querySelector('.oanix-organic-tags.is-reordering')) return

        const rect = scroller.getBoundingClientRect()
        let delta = 0
        const nearLeft = latestReorderPointerX < rect.left + REORDER_EDGE_PX
        const nearRight = latestReorderPointerX > Math.min(rect.right, controlsLeft) - REORDER_EDGE_PX

        if (nearLeft) {
          const strength = Math.min(1, (rect.left + REORDER_EDGE_PX - latestReorderPointerX) / REORDER_EDGE_PX)
          delta = -Math.max(1, Math.round(REORDER_MAX_SCROLL_PX * strength))
        } else if (nearRight) {
          const rightEdge = Math.min(rect.right, controlsLeft)
          const strength = Math.min(1, (latestReorderPointerX - (rightEdge - REORDER_EDGE_PX)) / REORDER_EDGE_PX)
          delta = Math.max(1, Math.round(REORDER_MAX_SCROLL_PX * strength))
        }

        if (delta === 0) return

        scroller.scrollLeft += delta
        if (now - lastEdgeSlotTickAt >= REORDER_SLOT_TICK_MS) {
          lastEdgeSlotTickAt = now
          window.dispatchEvent(new CustomEvent('oanix:tag-reorder-edge-tick', {
            detail: { clientX: latestReorderPointerX },
          }))
        }
        autoScrollFrame = window.requestAnimationFrame(tick)
      }

      autoScrollFrame = window.requestAnimationFrame(tick)
    }

    function handlePointerDown(event: PointerEvent) {
      // Desktop mouse reordering is owned by OrganicWorkspaceRuntime. This runtime
      // only augments coarse/touch-style input so both implementations never fight.
      if (event.pointerType === 'mouse') return
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
      if (event.pointerType === 'mouse') return
      if (!active || active.pointerId !== event.pointerId) return
      const scroller = document.querySelector<HTMLElement>('.oanix-organic-tags__scroll')
      if (!scroller) return

      if (document.querySelector('.oanix-organic-tags.is-reordering')) {
        active.scrolling = false
        suppressClickForId = active.tagId
        event.preventDefault()
        ensureDragOverlay(event)
        scheduleAutoScrollDuringReorder(scroller, event.clientX)
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
      resetActiveGesture()
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

    const handleVisibilityChange = () => {
      if (document.hidden) resetActiveGesture()
    }
    const handleBlur = () => resetActiveGesture()

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('pointermove', handlePointerMove, { capture: true, passive: false })
    document.addEventListener('pointerup', clearPointer, true)
    document.addEventListener('pointercancel', clearPointer, true)
    document.addEventListener('click', handleClick, true)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)

    return () => {
      resetActiveGesture()
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerup', clearPointer, true)
      document.removeEventListener('pointercancel', clearPointer, true)
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  return null
}
