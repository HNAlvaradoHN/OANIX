import { useEffect } from 'react'
import './tagMobileGesture.css'

const SWIPE_START_PX = 7

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

      // Once OrganicWorkspaceRuntime has entered reorder mode, it owns the pointer.
      if (document.querySelector('.oanix-organic-tags.is-reordering')) {
        active.scrolling = false
        return
      }

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
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerup', clearPointer, true)
      document.removeEventListener('pointercancel', clearPointer, true)
      document.removeEventListener('click', handleClick, true)
    }
  }, [])

  return null
}
