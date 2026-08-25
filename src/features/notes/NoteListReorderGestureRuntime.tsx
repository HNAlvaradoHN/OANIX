import { useEffect } from 'react'
import { persistNoteOrder } from './noteService'
import './noteReorderGesture.css'

const LONG_PRESS_MS = 220
const MOVE_CANCEL_PX = 12
const EDGE_SCROLL_PX = 86
const MAX_SCROLL_PER_FRAME = 11

type DropPlacement = 'before' | 'after'
type GesturePhase = 'pressing' | 'dragging'
type GestureInput = 'touch' | 'pointer'

interface NoteDragGesture {
  input: GestureInput
  pointerId: number | null
  touchId: number | null
  item: HTMLElement
  noteId: string
  list: HTMLElement
  startX: number
  startY: number
  lastX: number
  lastY: number
  grabOffsetX: number
  grabOffsetY: number
  phase: GesturePhase
  orderBefore: string[]
  nextOrder: string[]
  timer: number | null
  ghost: HTMLElement | null
  scrollFrame: number | null
  dropTarget: HTMLElement | null
  dropPlacement: DropPlacement | null
}

function noteRow(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  if (target.closest('.note-row__menu-wrap, button, a, input, textarea, select, [contenteditable="true"]')) return null
  return target.closest<HTMLElement>('.note-row[data-reorder-note-id]')
}

function noteOrder(list: HTMLElement): string[] {
  return Array.from(list.querySelectorAll<HTMLElement>(':scope > .note-row[data-reorder-note-id]'))
    .flatMap((item) => item.dataset.reorderNoteId ? [item.dataset.reorderNoteId] : [])
}

function rowPinned(row: HTMLElement): boolean {
  const title = row.querySelector<HTMLElement>('.note-row__topline > strong')
  return Boolean(title?.textContent?.trim().startsWith('📌'))
}

function clamp(value: number, min: number, max: number): number {
  if (max <= min) return min
  return Math.min(max, Math.max(min, value))
}

function pointInsideList(gesture: NoteDragGesture): boolean {
  const rect = gesture.list.getBoundingClientRect()
  return gesture.lastX >= rect.left
    && gesture.lastX <= rect.right
    && gesture.lastY >= rect.top
    && gesture.lastY <= rect.bottom
}

function createGhost(item: HTMLElement): HTMLElement {
  const rect = item.getBoundingClientRect()
  const ghost = item.cloneNode(true) as HTMLElement
  ghost.classList.add('oanix-mobile-note-drag-ghost')
  ghost.removeAttribute('data-reorder-note-id')
  ghost.removeAttribute('data-oanix-bulk-selected')
  ghost.setAttribute('aria-hidden', 'true')
  ghost.querySelectorAll<HTMLElement>('button, [role="button"]').forEach((element) => element.setAttribute('tabindex', '-1'))
  ghost.style.width = `${rect.width}px`
  ghost.style.height = `${rect.height}px`
  ghost.style.left = `${rect.left}px`
  ghost.style.top = `${rect.top}px`
  document.body.appendChild(ghost)
  return ghost
}

function positionGhost(gesture: NoteDragGesture) {
  if (!gesture.ghost) return
  const listRect = gesture.list.getBoundingClientRect()
  const ghostWidth = gesture.ghost.offsetWidth
  const ghostHeight = gesture.ghost.offsetHeight
  gesture.ghost.style.left = `${clamp(gesture.lastX - gesture.grabOffsetX, listRect.left, listRect.right - ghostWidth)}px`
  gesture.ghost.style.top = `${clamp(gesture.lastY - gesture.grabOffsetY, listRect.top, listRect.bottom - ghostHeight)}px`
}

function clearDropIndicator(gesture: NoteDragGesture) {
  gesture.dropTarget?.classList.remove('oanix-mobile-note-drop-before', 'oanix-mobile-note-drop-after')
  gesture.dropTarget = null
  gesture.dropPlacement = null
}

function buildNextOrder(orderBefore: string[], noteId: string, targetId: string, placement: DropPlacement): string[] {
  const withoutSource = orderBefore.filter((id) => id !== noteId)
  const targetIndex = withoutSource.indexOf(targetId)
  if (targetIndex < 0) return orderBefore
  const insertionIndex = placement === 'before' ? targetIndex : targetIndex + 1
  return [...withoutSource.slice(0, insertionIndex), noteId, ...withoutSource.slice(insertionIndex)]
}

function previewOrderAtPoint(gesture: NoteDragGesture) {
  if (!pointInsideList(gesture)) {
    clearDropIndicator(gesture)
    gesture.nextOrder = gesture.orderBefore
    return
  }
  const sourcePinned = rowPinned(gesture.item)
  const siblings = Array.from(gesture.list.querySelectorAll<HTMLElement>(':scope > .note-row[data-reorder-note-id]'))
    .filter((item) => item !== gesture.item && rowPinned(item) === sourcePinned)
  if (siblings.length === 0) {
    clearDropIndicator(gesture)
    gesture.nextOrder = gesture.orderBefore
    return
  }
  let target = siblings[siblings.length - 1]
  let placement: DropPlacement = 'after'
  for (const sibling of siblings) {
    const rect = sibling.getBoundingClientRect()
    if (gesture.lastY < rect.top + rect.height / 2) {
      target = sibling
      placement = 'before'
      break
    }
  }
  const targetId = target.dataset.reorderNoteId
  if (!targetId) return
  if (gesture.dropTarget !== target || gesture.dropPlacement !== placement) {
    clearDropIndicator(gesture)
    gesture.dropTarget = target
    gesture.dropPlacement = placement
    target.classList.add(placement === 'before' ? 'oanix-mobile-note-drop-before' : 'oanix-mobile-note-drop-after')
  }
  gesture.nextOrder = buildNextOrder(gesture.orderBefore, gesture.noteId, targetId, placement)
}

function scrollSpeed(clientY: number, rect: DOMRect): number {
  if (clientY < rect.top || clientY > rect.bottom) return 0
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

function findTouch(touches: TouchList, identifier: number | null): Touch | null {
  if (identifier === null) return null
  for (let index = 0; index < touches.length; index += 1) {
    const touch = touches.item(index)
    if (touch?.identifier === identifier) return touch
  }
  return null
}

export function NoteListReorderGestureRuntime() {
  useEffect(() => {
    let gesture: NoteDragGesture | null = null
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
      clearDropIndicator(gesture)
      gesture.ghost?.remove()
      gesture.ghost = null
      gesture.item.classList.remove('oanix-mobile-note-drag-source')
      document.documentElement.classList.remove('oanix-mobile-note-dragging')
      document.body.classList.remove('oanix-mobile-note-dragging')
      window.getSelection()?.removeAllRanges()
    }
    const cancelGesture = () => {
      if (!gesture) return
      clearTimer()
      cleanupVisuals()
      gesture = null
    }
    const startAutoScroll = () => {
      if (!gesture || gesture.phase !== 'dragging' || gesture.scrollFrame !== null) return
      const tick = () => {
        if (!gesture || gesture.phase !== 'dragging') return
        const speed = scrollSpeed(gesture.lastY, gesture.list.getBoundingClientRect())
        if (speed !== 0) {
          const before = gesture.list.scrollTop
          gesture.list.scrollTop += speed
          if (gesture.list.scrollTop !== before) {
            positionGhost(gesture)
            previewOrderAtPoint(gesture)
          }
        }
        gesture.scrollFrame = window.requestAnimationFrame(tick)
      }
      gesture.scrollFrame = window.requestAnimationFrame(tick)
    }
    const beginDrag = () => {
      if (!gesture || gesture.phase !== 'pressing') return
      if (document.documentElement.classList.contains('oanix-note-bulk-selecting')) return cancelGesture()
      clearTimer()
      gesture.phase = 'dragging'
      gesture.orderBefore = noteOrder(gesture.list)
      gesture.nextOrder = gesture.orderBefore
      window.getSelection()?.removeAllRanges()
      gesture.ghost = createGhost(gesture.item)
      gesture.item.classList.add('oanix-mobile-note-drag-source')
      document.documentElement.classList.add('oanix-mobile-note-dragging')
      document.body.classList.add('oanix-mobile-note-dragging')
      positionGhost(gesture)
      previewOrderAtPoint(gesture)
      startAutoScroll()
      navigator.vibrate?.(24)
      if (gesture.input === 'pointer' && gesture.pointerId !== null) {
        try { gesture.item.setPointerCapture(gesture.pointerId) } catch { /* best effort */ }
      }
    }
    const createGesture = (
      input: GestureInput,
      item: HTMLElement,
      noteId: string,
      list: HTMLElement,
      clientX: number,
      clientY: number,
      pointerId: number | null,
      touchId: number | null,
    ) => {
      const rect = item.getBoundingClientRect()
      gesture = {
        input, pointerId, touchId, item, noteId, list,
        startX: clientX, startY: clientY, lastX: clientX, lastY: clientY,
        grabOffsetX: clientX - rect.left, grabOffsetY: clientY - rect.top,
        phase: 'pressing', orderBefore: [], nextOrder: [],
        timer: window.setTimeout(beginDrag, LONG_PRESS_MS), ghost: null, scrollFrame: null,
        dropTarget: null, dropPlacement: null,
      }
    }
    const canStartFrom = (target: EventTarget | null) => {
      if (gesture) return null
      if (document.documentElement.classList.contains('oanix-note-bulk-selecting')) return null
      if (document.querySelector('.notes-shell--searching')) return null
      const item = noteRow(target)
      const noteId = item?.dataset.reorderNoteId
      const list = item?.parentElement
      if (!item || !noteId || !list?.classList.contains('notes-list')) return null
      return { item, noteId, list }
    }
    const updateDragPoint = (clientX: number, clientY: number, event?: Event) => {
      if (!gesture) return
      gesture.lastX = clientX
      gesture.lastY = clientY
      if (gesture.phase === 'pressing') {
        const distance = Math.hypot(clientX - gesture.startX, clientY - gesture.startY)
        if (distance >= MOVE_CANCEL_PX) cancelGesture()
        return
      }
      if (event?.cancelable) event.preventDefault()
      event?.stopPropagation()
      positionGhost(gesture)
      previewOrderAtPoint(gesture)
    }
    const finishGesture = async (event?: Event) => {
      if (!gesture) return
      const finished = gesture
      clearTimer()
      if (finished.phase !== 'dragging') {
        gesture = null
        return
      }
      if (event?.cancelable) event.preventDefault()
      event?.stopPropagation()
      suppressClickUntil = performance.now() + 520
      const nextOrder = finished.nextOrder.length > 0 ? finished.nextOrder : finished.orderBefore
      cleanupVisuals()
      gesture = null
      if (nextOrder.join('|') === finished.orderBefore.join('|')) return
      try {
        await persistNoteOrder(nextOrder)
        window.dispatchEvent(new CustomEvent('oanix:local-data-changed', { detail: { recordType: 'note' } }))
        window.dispatchEvent(new Event('oanix:workspace-refresh'))
        navigator.vibrate?.(12)
      } catch {
        window.dispatchEvent(new Event('oanix:workspace-refresh'))
      }
    }

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return cancelGesture()
      const start = canStartFrom(event.target)
      const touch = event.changedTouches.item(0)
      if (!start || !touch) return
      createGesture('touch', start.item, start.noteId, start.list, touch.clientX, touch.clientY, null, touch.identifier)
    }
    const onTouchMove = (event: TouchEvent) => {
      if (!gesture || gesture.input !== 'touch') return
      const touch = findTouch(event.touches, gesture.touchId)
      if (!touch) return
      updateDragPoint(touch.clientX, touch.clientY, event)
    }
    const onTouchEnd = (event: TouchEvent) => {
      if (!gesture || gesture.input !== 'touch') return
      const endedTouch = findTouch(event.changedTouches, gesture.touchId)
      if (!endedTouch) return
      void finishGesture(event)
    }
    const onTouchCancel = (event: TouchEvent) => {
      if (!gesture || gesture.input !== 'touch') return
      const cancelledTouch = findTouch(event.changedTouches, gesture.touchId)
      if (!cancelledTouch && event.changedTouches.length > 0) return
      cancelGesture()
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || event.pointerType === 'touch' || event.button !== 0 || !event.isPrimary) return
      const start = canStartFrom(event.target)
      if (!start) return
      createGesture('pointer', start.item, start.noteId, start.list, event.clientX, event.clientY, event.pointerId, null)
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!gesture || gesture.input !== 'pointer' || event.pointerId !== gesture.pointerId) return
      updateDragPoint(event.clientX, event.clientY, event)
    }
    const onPointerUp = (event: PointerEvent) => {
      if (!gesture || gesture.input !== 'pointer' || event.pointerId !== gesture.pointerId) return
      void finishGesture(event)
    }
    const onPointerCancel = (event: PointerEvent) => {
      if (!gesture || gesture.input !== 'pointer' || event.pointerId !== gesture.pointerId) return
      cancelGesture()
    }
    const onLostPointerCapture = (event: PointerEvent) => {
      if (!gesture || gesture.input !== 'pointer' || event.pointerId !== gesture.pointerId) return
      cancelGesture()
    }
    const onClick = (event: MouseEvent) => {
      if (performance.now() >= suppressClickUntil || !noteRow(event.target)) return
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    const onContextMenu = (event: MouseEvent) => {
      if (!noteRow(event.target)) return
      event.preventDefault()
    }
    const onSelectStart = (event: Event) => {
      if (!noteRow(event.target)) return
      event.preventDefault()
      if (gesture?.phase === 'dragging') window.getSelection()?.removeAllRanges()
    }
    const onDragStart = (event: DragEvent) => {
      if (!noteRow(event.target)) return
      event.preventDefault()
    }
    const onVisibilityChange = () => { if (document.hidden) cancelGesture() }
    const onBlur = () => cancelGesture()

    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false })
    document.addEventListener('touchend', onTouchEnd, { capture: true, passive: false })
    document.addEventListener('touchcancel', onTouchCancel, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointermove', onPointerMove, { capture: true, passive: false })
    document.addEventListener('pointerup', onPointerUp, true)
    document.addEventListener('pointercancel', onPointerCancel, true)
    document.addEventListener('lostpointercapture', onLostPointerCapture, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('contextmenu', onContextMenu, true)
    document.addEventListener('selectstart', onSelectStart, true)
    document.addEventListener('dragstart', onDragStart, true)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)
    return () => {
      cancelGesture()
      document.removeEventListener('touchstart', onTouchStart, true)
      document.removeEventListener('touchmove', onTouchMove, true)
      document.removeEventListener('touchend', onTouchEnd, true)
      document.removeEventListener('touchcancel', onTouchCancel, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointermove', onPointerMove, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      document.removeEventListener('pointercancel', onPointerCancel, true)
      document.removeEventListener('lostpointercapture', onLostPointerCapture, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('contextmenu', onContextMenu, true)
      document.removeEventListener('selectstart', onSelectStart, true)
      document.removeEventListener('dragstart', onDragStart, true)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
      document.documentElement.classList.remove('oanix-mobile-note-dragging')
      document.body.classList.remove('oanix-mobile-note-dragging')
    }
  }, [])
  return null
}
