import { useEffect } from 'react'
import { persistFolderOrder } from './folderService'
import './folderMobileDrag.css'

const LONG_PRESS_MS = 340
const MOVE_CANCEL_PX = 9
const EDGE_SCROLL_PX = 54
const MAX_SCROLL_PER_FRAME = 17

interface TouchGesture {
  pointerId: number
  item: HTMLElement
  folderId: string
  rail: HTMLElement
  startX: number
  startY: number
  lastX: number
  lastY: number
  startScrollLeft: number
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
  const rect = gesture.item.getBoundingClientRect()
  gesture.ghost.style.left = `${gesture.lastX - rect.width / 2}px`
  gesture.ghost.style.top = `${gesture.lastY - rect.height / 2}px`
}

function reorderDomAtPoint(gesture: TouchGesture) {
  const target = document.elementFromPoint(gesture.lastX, gesture.lastY)
    ?.closest<HTMLElement>('.oanix-folder-rail__item[data-oanix-folder-id]')
  if (!target || target === gesture.item || target.parentElement !== gesture.rail) return

  const rect = target.getBoundingClientRect()
  const placeAfter = gesture.lastX > rect.left + rect.width / 2
  if (placeAfter) {
    const next = target.nextElementSibling
    if (next === gesture.item) return
    gesture.rail.insertBefore(gesture.item, next)
  } else {
    if (target.previousElementSibling === gesture.item) return
    gesture.rail.insertBefore(gesture.item, target)
  }
}

function scrollSpeed(clientX: number, rect: DOMRect): number {
  if (clientX < rect.left + EDGE_SCROLL_PX) {
    const strength = Math.min(1, (rect.left + EDGE_SCROLL_PX - clientX) / EDGE_SCROLL_PX)
    return -Math.max(4, Math.round(MAX_SCROLL_PER_FRAME * strength))
  }
  if (clientX > rect.right - EDGE_SCROLL_PX) {
    const strength = Math.min(1, (clientX - (rect.right - EDGE_SCROLL_PX)) / EDGE_SCROLL_PX)
    return Math.max(4, Math.round(MAX_SCROLL_PER_FRAME * strength))
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
          if (gesture.rail.scrollLeft !== before) reorderDomAtPoint(gesture)
        }
        gesture.scrollFrame = window.requestAnimationFrame(tick)
      }
      gesture.scrollFrame = window.requestAnimationFrame(tick)
    }

    const beginDrag = () => {
      if (!gesture || gesture.moved || gesture.dragging) return
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
      gesture = {
        pointerId: event.pointerId,
        item,
        folderId,
        rail,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        startScrollLeft: rail.scrollLeft,
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
        if (Math.hypot(dx, dy) < MOVE_CANCEL_PX) return
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

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointermove', onPointerMove, true)
    document.addEventListener('pointerup', persistAndFinish, true)
    document.addEventListener('pointercancel', cancelGesture, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('contextmenu', onContextMenu, true)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', () => cancelGesture())

    return () => {
      cancelGesture()
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointermove', onPointerMove, true)
      document.removeEventListener('pointerup', persistAndFinish, true)
      document.removeEventListener('pointercancel', cancelGesture, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('contextmenu', onContextMenu, true)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return null
}
