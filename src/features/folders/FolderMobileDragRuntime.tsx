import { useEffect } from 'react'
import { persistFolderOrder } from './folderService'
import './folderMobileDrag.css'

const LONG_PRESS_MS = 220
const PRESS_ARM_GRACE_MS = 35
const MOVE_CANCEL_PX = 14
const EDGE_SCROLL_PX = 72
const MAX_SCROLL_PER_FRAME = 10
const REFLOW_MS = 120

interface TouchGesture {
  pointerId: number
  item: HTMLElement
  folderId: string
  rail: HTMLElement
  startX: number
  startY: number
  lastX: number
  lastY: number
  pressedAt: number
  startScrollLeft: number
  grabOffsetX: number
  grabOffsetY: number
  moved: boolean
  dragging: boolean
  orderBefore: string[]
  timer: number | null
  ghost: HTMLElement | null
  scrollFrame: number | null
}

function folderItem(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  if (target.closest('.oanix-folder-card__gear')) return null
  return target.closest<HTMLElement>('.oanix-folder-rail__item[data-oanix-folder-id]')
}

function folderOrder(rail: HTMLElement): string[] {
  return Array.from(rail.querySelectorAll<HTMLElement>(':scope > .oanix-folder-rail__item[data-oanix-folder-id]'))
    .flatMap((item) => item.dataset.oanixFolderId ? [item.dataset.oanixFolderId] : [])
}

function restoreDomOrder(rail: HTMLElement, ids: string[]) {
  const byId = new Map(
    Array.from(rail.querySelectorAll<HTMLElement>(':scope > .oanix-folder-rail__item[data-oanix-folder-id]'))
      .flatMap((item) => item.dataset.oanixFolderId ? [[item.dataset.oanixFolderId, item] as const] : []),
  )
  ids.forEach((id) => {
    const item = byId.get(id)
    if (item) rail.appendChild(item)
  })
}

function createGhost(item: HTMLElement): HTMLElement {
  const rect = item.getBoundingClientRect()
  const ghost = item.cloneNode(true) as HTMLElement
  ghost.classList.add('oanix-mobile-folder-drag-ghost')
  ghost.removeAttribute('data-oanix-folder-id')
  ghost.setAttribute('aria-hidden', 'true')
  ghost.style.width = `${rect.width}px`
  ghost.style.height = `${rect.height}px`
  ghost.style.left = `${rect.left}px`
  ghost.style.top = `${rect.top}px`
  document.body.appendChild(ghost)
  return ghost
}

function positionGhost(gesture: TouchGesture) {
  if (!gesture.ghost) return
  gesture.ghost.style.left = `${gesture.lastX - gesture.grabOffsetX}px`
  gesture.ghost.style.top = `${gesture.lastY - gesture.grabOffsetY}px`
}

function snapshotRects(rail: HTMLElement): Map<HTMLElement, DOMRect> {
  return new Map(
    Array.from(rail.querySelectorAll<HTMLElement>(':scope > .oanix-folder-rail__item[data-oanix-folder-id]'))
      .map((item) => [item, item.getBoundingClientRect()] as const),
  )
}

function animateReflow(rail: HTMLElement, before: Map<HTMLElement, DOMRect>) {
  for (const item of Array.from(rail.querySelectorAll<HTMLElement>(':scope > .oanix-folder-rail__item[data-oanix-folder-id]'))) {
    const previous = before.get(item)
    if (!previous) continue
    const next = item.getBoundingClientRect()
    const dx = previous.left - next.left
    const dy = previous.top - next.top
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
    item.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration: REFLOW_MS, easing: 'cubic-bezier(.2,.8,.2,1)' },
    )
  }
}

function reorderDomAtPoint(gesture: TouchGesture, animate = true) {
  const siblings = Array.from(
    gesture.rail.querySelectorAll<HTMLElement>(':scope > .oanix-folder-rail__item[data-oanix-folder-id]'),
  ).filter((item) => item !== gesture.item)

  const beforeOrder = folderOrder(gesture.rail).join('|')
  const beforeRects = animate ? snapshotRects(gesture.rail) : null
  const insertionTarget = siblings.find((item) => {
    const rect = item.getBoundingClientRect()
    return gesture.lastX < rect.left + rect.width / 2
  })

  if (insertionTarget) gesture.rail.insertBefore(gesture.item, insertionTarget)
  else gesture.rail.appendChild(gesture.item)

  const changed = folderOrder(gesture.rail).join('|') !== beforeOrder
  if (!changed) return

  if (animate && beforeRects) {
    animateReflow(gesture.rail, beforeRects)
    gesture.item.animate(
      [{ boxShadow: '0 0 0 0 rgba(59,130,246,0)' }, { boxShadow: '0 0 0 3px rgba(59,130,246,.24)' }],
      { duration: 120, easing: 'ease-out' },
    )
  }
}

function scrollSpeed(clientX: number, rect: DOMRect): number {
  if (clientX < rect.left + EDGE_SCROLL_PX) {
    const strength = Math.min(1, (rect.left + EDGE_SCROLL_PX - clientX) / EDGE_SCROLL_PX)
    return -Math.max(2, Math.round(MAX_SCROLL_PER_FRAME * strength))
  }
  if (clientX > rect.right - EDGE_SCROLL_PX) {
    const strength = Math.min(1, (clientX - (rect.right - EDGE_SCROLL_PX)) / EDGE_SCROLL_PX)
    return Math.max(2, Math.round(MAX_SCROLL_PER_FRAME * strength))
  }
  return 0
}

export function FolderMobileDragRuntime() {
  useEffect(() => {
    let gesture: TouchGesture | null = null
    let suppressClickUntil = 0

    const clearTimer = () => {
      if (!gesture || gesture.timer === null) return
      window.clearTimeout(gesture.timer)
      gesture.timer = null
    }

    const stopAutoScroll = () => {
      if (!gesture || gesture.scrollFrame === null) return
      window.cancelAnimationFrame(gesture.scrollFrame)
      gesture.scrollFrame = null
    }

    const cleanupVisuals = () => {
      if (!gesture) return
      stopAutoScroll()
      gesture.ghost?.remove()
      gesture.ghost = null
      gesture.item.classList.remove('oanix-mobile-folder-drag-source')
      document.documentElement.classList.remove('oanix-mobile-folder-dragging')
      document.body.classList.remove('oanix-mobile-folder-dragging')
    }

    const startAutoScroll = () => {
      if (!gesture || !gesture.dragging || gesture.scrollFrame !== null) return
      const tick = () => {
        if (!gesture || !gesture.dragging) return
        const rect = gesture.rail.getBoundingClientRect()
        const speed = scrollSpeed(gesture.lastX, rect)
        if (speed !== 0) {
          const before = gesture.rail.scrollLeft
          gesture.rail.scrollLeft += speed
          if (gesture.rail.scrollLeft !== before) reorderDomAtPoint(gesture, false)
        }
        gesture.scrollFrame = window.requestAnimationFrame(tick)
      }
      gesture.scrollFrame = window.requestAnimationFrame(tick)
    }

    const beginDrag = () => {
      if (!gesture || gesture.moved || gesture.dragging) return
      clearTimer()
      gesture.dragging = true
      gesture.orderBefore = folderOrder(gesture.rail)
      gesture.ghost = createGhost(gesture.item)
      gesture.item.classList.add('oanix-mobile-folder-drag-source')
      document.documentElement.classList.add('oanix-mobile-folder-dragging')
      document.body.classList.add('oanix-mobile-folder-dragging')
      positionGhost(gesture)
      startAutoScroll()
      if ('vibrate' in navigator) navigator.vibrate?.(24)
      try {
        gesture.item.setPointerCapture(gesture.pointerId)
      } catch {
        // Pointer capture is best effort on WebView implementations.
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || event.button !== 0 || gesture) return
      const item = folderItem(event.target)
      const folderId = item?.dataset.oanixFolderId
      const rail = item?.parentElement
      if (!item || !folderId || !rail?.classList.contains('oanix-folder-rail__scroll')) return

      event.stopPropagation()
      const rect = item.getBoundingClientRect()
      gesture = {
        pointerId: event.pointerId,
        item,
        folderId,
        rail,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        pressedAt: performance.now(),
        startScrollLeft: rail.scrollLeft,
        grabOffsetX: event.clientX - rect.left,
        grabOffsetY: event.clientY - rect.top,
        moved: false,
        dragging: false,
        orderBefore: [],
        timer: window.setTimeout(beginDrag, LONG_PRESS_MS),
        ghost: null,
        scrollFrame: null,
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.pointerId) return
      event.stopPropagation()
      gesture.lastX = event.clientX
      gesture.lastY = event.clientY

      if (!gesture.dragging) {
        const dx = event.clientX - gesture.startX
        const dy = event.clientY - gesture.startY
        const distance = Math.hypot(dx, dy)
        if (distance < MOVE_CANCEL_PX) return

        const heldFor = performance.now() - gesture.pressedAt
        if (heldFor >= LONG_PRESS_MS - PRESS_ARM_GRACE_MS) {
          beginDrag()
          if (gesture?.dragging) {
            event.preventDefault()
            positionGhost(gesture)
            reorderDomAtPoint(gesture)
            return
          }
        }

        gesture.moved = true
        clearTimer()
        if (Math.abs(dx) >= Math.abs(dy)) {
          event.preventDefault()
          gesture.rail.scrollLeft = gesture.startScrollLeft - dx
        }
        return
      }

      event.preventDefault()
      positionGhost(gesture)
      reorderDomAtPoint(gesture)
    }

    const persistAndFinish = async (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.pointerId) return
      const finished = gesture
      event.stopPropagation()
      clearTimer()

      if (!finished.dragging) {
        if (finished.moved) suppressClickUntil = performance.now() + 380
        gesture = null
        return
      }

      event.preventDefault()
      suppressClickUntil = performance.now() + 520
      const nextOrder = folderOrder(finished.rail)
      cleanupVisuals()
      gesture = null

      try {
        await persistFolderOrder(nextOrder)
        window.dispatchEvent(new Event('oanix:local-data-changed'))
        if ('vibrate' in navigator) navigator.vibrate?.(12)
      } catch {
        restoreDomOrder(finished.rail, finished.orderBefore)
        window.dispatchEvent(new Event('oanix:local-data-changed'))
      }
    }

    const cancelGesture = (event?: PointerEvent) => {
      if (!gesture || (event && event.pointerId !== gesture.pointerId)) return
      if (event) event.stopPropagation()
      clearTimer()
      if (gesture.dragging && gesture.orderBefore.length) restoreDomOrder(gesture.rail, gesture.orderBefore)
      cleanupVisuals()
      gesture = null
    }

    const onWheel = (event: WheelEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const rail = target.closest<HTMLElement>('.oanix-folder-rail__scroll')
      if (!rail) return

      const canScrollVertically = rail.scrollHeight > rail.clientHeight + 1
      const canScrollHorizontally = rail.scrollWidth > rail.clientWidth + 1
      if (!canScrollVertically && !canScrollHorizontally) return

      if (canScrollVertically && Math.abs(event.deltaY) >= Math.abs(event.deltaX)) {
        const before = rail.scrollTop
        rail.scrollTop += event.deltaY
        if (rail.scrollTop !== before) event.preventDefault()
        return
      }

      if (canScrollHorizontally) {
        const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
        if (!delta) return
        const before = rail.scrollLeft
        rail.scrollLeft += delta
        if (rail.scrollLeft !== before) event.preventDefault()
      }
    }

    const onClick = (event: MouseEvent) => {
      if (performance.now() >= suppressClickUntil) return
      if (!folderItem(event.target)) return
      event.preventDefault()
      event.stopPropagation()
    }

    const onContextMenu = (event: MouseEvent) => {
      if (!folderItem(event.target)) return
      event.preventDefault()
    }

    const onVisibilityChange = () => {
      if (document.hidden) cancelGesture()
    }
    const onBlur = () => cancelGesture()

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointermove', onPointerMove, true)
    document.addEventListener('pointerup', persistAndFinish, true)
    document.addEventListener('pointercancel', cancelGesture, true)
    document.addEventListener('wheel', onWheel, { capture: true, passive: false })
    document.addEventListener('click', onClick, true)
    document.addEventListener('contextmenu', onContextMenu, true)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)

    return () => {
      cancelGesture()
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointermove', onPointerMove, true)
      document.removeEventListener('pointerup', persistAndFinish, true)
      document.removeEventListener('pointercancel', cancelGesture, true)
      document.removeEventListener('wheel', onWheel, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('contextmenu', onContextMenu, true)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  return null
}
