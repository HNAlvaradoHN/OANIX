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
  scroller: HTMLElement
  root: HTMLElement
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
    let dragOverlayWidth = 0
    let reorderGeometry: { controlsLeft: number; scrollerLeft: number; scrollerRight: number } | null = null
    let autoScrollFrame: number | null = null
    let latestReorderPointerX = 0
    let lastEdgeSlotTickAt = 0
    let gestureListenersAttached = false

    function removeDragOverlay() {
      dragOverlay?.remove()
      dragOverlay = null
      document.documentElement.classList.remove('oanix-tag-drag-overlay-active')
    }

    function attachGestureListeners() {
      if (gestureListenersAttached) return
      gestureListenersAttached = true
      document.addEventListener('pointermove', handlePointerMove, { capture: true, passive: false })
      document.addEventListener('pointerup', clearPointer, true)
      document.addEventListener('pointercancel', clearPointer, true)
    }

    function detachGestureListeners() {
      if (!gestureListenersAttached) return
      gestureListenersAttached = false
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerup', clearPointer, true)
      document.removeEventListener('pointercancel', clearPointer, true)
    }

    function resetActiveGesture() {
      active = null
      dragOverlayWidth = 0
      reorderGeometry = null
      if (autoScrollFrame !== null) {
        window.cancelAnimationFrame(autoScrollFrame)
        autoScrollFrame = null
      }
      removeDragOverlay()
      detachGestureListeners()
    }

    function geometryForReorder(scroller: HTMLElement) {
      if (reorderGeometry) return reorderGeometry
      const scrollerRect = scroller.getBoundingClientRect()
      const controlsLeft = document.querySelector<HTMLElement>('.oanix-organic-tags__controls')
        ?.getBoundingClientRect().left ?? scrollerRect.right
      reorderGeometry = {
        controlsLeft,
        scrollerLeft: scrollerRect.left,
        scrollerRight: scrollerRect.right,
      }
      return reorderGeometry
    }

    function ensureDragOverlay(event: PointerEvent, scroller: HTMLElement, root: HTMLElement) {
      if (!dragOverlay) {
        const source = root.querySelector<HTMLElement>(
          '.oanix-organic-tag-chip.is-dragging[data-oanix-organic-tag-id]',
        )
        if (!source) {
          removeDragOverlay()
          return
        }

        const rect = source.getBoundingClientRect()
        dragOffsetX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width)
        dragOffsetY = Math.min(Math.max(event.clientY - rect.top, 0), rect.height)
        dragOverlay = source.cloneNode(true) as HTMLElement
        dragOverlay.classList.remove('is-dragging', 'is-active')
        dragOverlay.classList.add('oanix-tag-drag-overlay')
        dragOverlay.removeAttribute('data-oanix-organic-tag-id')
        dragOverlay.setAttribute('aria-hidden', 'true')
        dragOverlayWidth = rect.width
        dragOverlay.style.width = `${rect.width}px`
        dragOverlay.style.height = `${rect.height}px`
        document.body.appendChild(dragOverlay)
        document.documentElement.classList.add('oanix-tag-drag-overlay-active')
      }

      const geometry = geometryForReorder(scroller)
      const clampedLeft = Math.min(
        event.clientX - dragOffsetX,
        geometry.controlsLeft - REORDER_RIGHT_GUARD_PX - dragOverlayWidth,
      )
      dragOverlay.style.left = `${clampedLeft}px`
      dragOverlay.style.top = `${event.clientY - dragOffsetY}px`
    }

    function scheduleAutoScrollDuringReorder(scroller: HTMLElement, pointerX: number) {
      const geometry = geometryForReorder(scroller)
      latestReorderPointerX = Math.min(pointerX, geometry.controlsLeft - REORDER_RIGHT_GUARD_PX)
      if (autoScrollFrame !== null) return

      const tick = (now: number) => {
        autoScrollFrame = null
        const current = active
        if (!current || current.scroller !== scroller || !current.root.classList.contains('is-reordering')) return

        let delta = 0
        const rightEdge = Math.min(geometry.scrollerRight, geometry.controlsLeft)
        const nearLeft = latestReorderPointerX < geometry.scrollerLeft + REORDER_EDGE_PX
        const nearRight = latestReorderPointerX > rightEdge - REORDER_EDGE_PX

        if (nearLeft) {
          const strength = Math.min(1, (geometry.scrollerLeft + REORDER_EDGE_PX - latestReorderPointerX) / REORDER_EDGE_PX)
          delta = -Math.max(1, Math.round(REORDER_MAX_SCROLL_PX * strength))
        } else if (nearRight) {
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
      const root = scroller?.closest<HTMLElement>('.oanix-organic-tags')
      const tagId = chip ? tagIdFromTarget(chip) : ''
      if (!chip || !scroller || !root || !tagId) return

      active = {
        pointerId: event.pointerId,
        tagId,
        scroller,
        root,
        startX: event.clientX,
        startY: event.clientY,
        startScrollLeft: scroller.scrollLeft,
        scrolling: false,
      }
      attachGestureListeners()
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType === 'mouse') return
      if (!active || active.pointerId !== event.pointerId) return
      const current = active
      const { scroller, root } = current

      if (root.classList.contains('is-reordering')) {
        current.scrolling = false
        suppressClickForId = current.tagId
        event.preventDefault()
        ensureDragOverlay(event, scroller, root)
        scheduleAutoScrollDuringReorder(scroller, event.clientX)
        return
      }

      removeDragOverlay()
      const dx = event.clientX - current.startX
      const dy = event.clientY - current.startY
      if (!current.scrolling) {
        if (Math.abs(dx) < SWIPE_START_PX) return
        if (Math.abs(dx) <= Math.abs(dy)) return
        current.scrolling = true
      }

      event.preventDefault()
      scroller.scrollLeft = current.startScrollLeft - dx
      suppressClickForId = current.tagId
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
    document.addEventListener('click', handleClick, true)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)

    return () => {
      resetActiveGesture()
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  return null
}
