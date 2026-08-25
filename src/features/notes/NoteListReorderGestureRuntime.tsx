import { useEffect } from 'react'
import { persistNoteOrder } from './noteService'
import './noteReorderGesture.css'

const LONG_PRESS_MS = 340
const PRESS_ARM_GRACE_MS = 55
const MOVE_CANCEL_PX = 14
const EDGE_SCROLL_PX = 72
const MAX_SCROLL_PER_FRAME = 9
const REFLOW_MS = 180

interface TouchGesture {
  pointerId: number
  item: HTMLElement
  noteId: string
  list: HTMLElement
  startX: number
  startY: number
  lastX: number
  lastY: number
  pressedAt: number
  startScrollTop: number
  grabOffsetX: number
  grabOffsetY: number
  moved: boolean
  dragging: boolean
  orderBefore: string[]
  timer: number | null
  ghost: HTMLElement | null
  scrollFrame: number | null
}

function interactionBlocked(): boolean {
  return document.documentElement.classList.contains('oanix-note-bulk-selecting')
    || Boolean(document.querySelector('.notes-shell--searching'))
}

function noteItem(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element) || interactionBlocked()) return null
  if (target.closest('.note-row__menu-wrap, button, a, input, textarea, select, [contenteditable="true"]')) return null
  return target.closest<HTMLElement>('.note-row[data-reorder-note-id]')
}

function rowPinned(row: HTMLElement): boolean {
  const title = row.querySelector<HTMLElement>('.note-row__topline > strong')
  return Boolean(title?.textContent?.trim().startsWith('📌'))
}

function noteOrder(list: HTMLElement): string[] {
  return Array.from(list.querySelectorAll<HTMLElement>(':scope > .note-row[data-reorder-note-id]'))
    .flatMap((row) => row.dataset.reorderNoteId ? [row.dataset.reorderNoteId] : [])
}

function restoreDomOrder(list: HTMLElement, ids: string[]) {
  const byId = new Map(
    Array.from(list.querySelectorAll<HTMLElement>(':scope > .note-row[data-reorder-note-id]'))
      .flatMap((row) => row.dataset.reorderNoteId ? [[row.dataset.reorderNoteId, row] as const] : []),
  )
  ids.forEach((id) => {
    const row = byId.get(id)
    if (row) list.appendChild(row)
  })
}

function createGhost(item: HTMLElement): HTMLElement {
  const rect = item.getBoundingClientRect()
  const ghost = item.cloneNode(true) as HTMLElement
  ghost.classList.add('oanix-mobile-note-drag-ghost')
  ghost.removeAttribute('data-reorder-note-id')
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

function snapshotRects(list: HTMLElement): Map<HTMLElement, DOMRect> {
  return new Map(
    Array.from(list.querySelectorAll<HTMLElement>(':scope > .note-row[data-reorder-note-id]'))
      .map((row) => [row, row.getBoundingClientRect()] as const),
  )
}

function animateReflow(list: HTMLElement, before: Map<HTMLElement, DOMRect>) {
  for (const row of Array.from(list.querySelectorAll<HTMLElement>(':scope > .note-row[data-reorder-note-id]'))) {
    const previous = before.get(row)
    if (!previous) continue
    const next = row.getBoundingClientRect()
    const dx = previous.left - next.left
    const dy = previous.top - next.top
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
    row.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration: REFLOW_MS, easing: 'cubic-bezier(.2,.8,.2,1)' },
    )
  }
}

function reorderDomAtPoint(gesture: TouchGesture, animate = true) {
  const pinned = rowPinned(gesture.item)
  const siblings = Array.from(
    gesture.list.querySelectorAll<HTMLElement>(':scope > .note-row[data-reorder-note-id]'),
  ).filter((row) => row !== gesture.item && rowPinned(row) === pinned)

  const beforeOrder = noteOrder(gesture.list).join('|')
  const beforeRects = animate ? snapshotRects(gesture.list) : null
  const insertionTarget = siblings.find((row) => {
    const rect = row.getBoundingClientRect()
    return gesture.lastY < rect.top + rect.height / 2
  })

  if (insertionTarget) gesture.list.insertBefore(gesture.item, insertionTarget)
  else {
    const allRows = Array.from(
      gesture.list.querySelectorAll<HTMLElement>(':scope > .note-row[data-reorder-note-id]'),
    ).filter((row) => row !== gesture.item)
    const lastSameGroup = [...allRows].reverse().find((row) => rowPinned(row) === pinned)
    if (lastSameGroup?.nextSibling) gesture.list.insertBefore(gesture.item, lastSameGroup.nextSibling)
    else if (lastSameGroup) gesture.list.appendChild(gesture.item)
  }

  const changed = noteOrder(gesture.list).join('|') !== beforeOrder
  if (!changed) return

  if (animate && beforeRects) animateReflow(gesture.list, beforeRects)
}

function scrollSpeed(clientY: number, rect: DOMRect): number {
  if (clientY < rect.top + EDGE_SCROLL_PX) {
    const strength = Math.min(1, (rect.top + EDGE_SCROLL_PX - clientY) / EDGE_SCROLL_PX)
    return -Math.max(2, Math.round(MAX_SCROLL_PER_FRAME * strength))
  }
  if (clientY > rect.bottom - EDGE_SCROLL_PX) {
    const strength = Math.min(1, (clientY - (rect.bottom - EDGE_SCROLL_PX)) / EDGE_SCROLL_PX)
    return Math.max(2, Math.round(MAX_SCROLL_PER_FRAME * strength))
  }
  return 0
}

export function NoteListReorderGestureRuntime() {
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
      gesture.item.classList.remove('oanix-mobile-note-drag-source')
      document.documentElement.classList.remove('oanix-mobile-note-dragging')
      document.body.classList.remove('oanix-mobile-note-dragging')
      window.getSelection()?.removeAllRanges()
    }

    const startAutoScroll = () => {
      if (!gesture || !gesture.dragging || gesture.scrollFrame !== null) return
      const tick = () => {
        if (!gesture || !gesture.dragging) return
        const rect = gesture.list.getBoundingClientRect()
        const speed = scrollSpeed(gesture.lastY, rect)
        if (speed !== 0) {
          const before = gesture.list.scrollTop
          gesture.list.scrollTop += speed
          if (gesture.list.scrollTop !== before) reorderDomAtPoint(gesture, false)
        }
        gesture.scrollFrame = window.requestAnimationFrame(tick)
      }
      gesture.scrollFrame = window.requestAnimationFrame(tick)
    }

    const beginDrag = () => {
      if (!gesture || gesture.moved || gesture.dragging || interactionBlocked()) return
      clearTimer()
      gesture.dragging = true
      gesture.orderBefore = noteOrder(gesture.list)
      gesture.ghost = createGhost(gesture.item)
      gesture.item.classList.add('oanix-mobile-note-drag-source')
      document.documentElement.classList.add('oanix-mobile-note-dragging')
      document.body.classList.add('oanix-mobile-note-dragging')
      positionGhost(gesture)
      startAutoScroll()
      navigator.vibrate?.(24)
      try {
        gesture.item.setPointerCapture(gesture.pointerId)
      } catch {
        // Pointer capture is best effort on WebView implementations.
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || event.button !== 0 || gesture) return
      const item = noteItem(event.target)
      const noteId = item?.dataset.reorderNoteId
      const list = item?.parentElement
      if (!item || !noteId || !list?.classList.contains('notes-list')) return

      event.stopPropagation()
      const rect = item.getBoundingClientRect()
      gesture = {
        pointerId: event.pointerId,
        item,
        noteId,
        list,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        pressedAt: performance.now(),
        startScrollTop: list.scrollTop,
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
        if (Math.abs(dy) >= Math.abs(dx)) {
          event.preventDefault()
          gesture.list.scrollTop = gesture.startScrollTop - dy
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
      const nextOrder = noteOrder(finished.list)
      cleanupVisuals()
      gesture = null

      try {
        await persistNoteOrder(nextOrder)
        window.dispatchEvent(new CustomEvent('oanix:local-data-changed', { detail: { recordType: 'note' } }))
        window.dispatchEvent(new Event('oanix:workspace-refresh'))
        navigator.vibrate?.(12)
      } catch {
        restoreDomOrder(finished.list, finished.orderBefore)
        window.dispatchEvent(new Event('oanix:workspace-refresh'))
      }
    }

    const cancelGesture = (event?: PointerEvent) => {
      if (!gesture || (event && event.pointerId !== gesture.pointerId)) return
      if (event) event.stopPropagation()
      clearTimer()
      if (gesture.dragging && gesture.orderBefore.length) restoreDomOrder(gesture.list, gesture.orderBefore)
      cleanupVisuals()
      gesture = null
    }

    const onClick = (event: MouseEvent) => {
      if (performance.now() >= suppressClickUntil) return
      if (!noteItem(event.target)) return
      event.preventDefault()
      event.stopImmediatePropagation()
    }

    const blockNativeLongPress = (event: Event) => {
      if (!noteItem(event.target)) return
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
    document.addEventListener('click', onClick, true)
    document.addEventListener('contextmenu', blockNativeLongPress, true)
    document.addEventListener('selectstart', blockNativeLongPress, true)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)

    return () => {
      cancelGesture()
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointermove', onPointerMove, true)
      document.removeEventListener('pointerup', persistAndFinish, true)
      document.removeEventListener('pointercancel', cancelGesture, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('contextmenu', blockNativeLongPress, true)
      document.removeEventListener('selectstart', blockNativeLongPress, true)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  return null
}
