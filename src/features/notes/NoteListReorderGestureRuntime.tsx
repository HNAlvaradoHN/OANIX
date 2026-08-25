import { useEffect } from 'react'
import { persistNoteOrder } from './noteService'
import './noteReorderGesture.css'

const LONG_PRESS_MS = 280
const MOVE_CANCEL_PX = 10
const EDGE_SCROLL_PX = 72
const MAX_SCROLL_PER_FRAME = 12

type PointerDragGesture = {
  pointerId: number
  item: HTMLElement
  noteId: string
  list: HTMLElement
  startX: number
  startY: number
  lastX: number
  lastY: number
  offsetX: number
  offsetY: number
  timer: number | null
  dragging: boolean
  scrolling: boolean
  clone: HTMLElement | null
  placeholder: HTMLElement | null
  originalDisplay: string
  scrollFrame: number | null
}

function noteRow(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  if (target.closest('.note-row__menu-wrap, button, a, input, textarea, select, [contenteditable="true"]')) return null
  return target.closest<HTMLElement>('.note-row[data-reorder-note-id]')
}

function rowPinned(row: HTMLElement): boolean {
  const title = row.querySelector<HTMLElement>('.note-row__topline > strong')
  return Boolean(title?.textContent?.trim().startsWith('📌'))
}

function clamp(value: number, min: number, max: number): number {
  if (max <= min) return min
  return Math.min(max, Math.max(min, value))
}

function createPlaceholder(item: HTMLElement): HTMLElement {
  const rect = item.getBoundingClientRect()
  const placeholder = document.createElement('div')
  placeholder.className = 'oanix-mobile-note-placeholder'
  placeholder.style.height = `${rect.height}px`
  placeholder.setAttribute('aria-hidden', 'true')
  return placeholder
}

function createClone(item: HTMLElement): HTMLElement {
  const rect = item.getBoundingClientRect()
  const clone = item.cloneNode(true) as HTMLElement
  clone.classList.add('oanix-mobile-note-drag-ghost')
  clone.removeAttribute('data-reorder-note-id')
  clone.removeAttribute('data-oanix-bulk-selected')
  clone.setAttribute('aria-hidden', 'true')
  clone.querySelectorAll<HTMLElement>('button, [role="button"]').forEach((element) => element.setAttribute('tabindex', '-1'))
  clone.style.width = `${rect.width}px`
  clone.style.height = `${rect.height}px`
  clone.style.left = `${rect.left}px`
  clone.style.top = `${rect.top}px`
  document.body.appendChild(clone)
  return clone
}

function positionClone(gesture: PointerDragGesture) {
  if (!gesture.clone) return
  const listRect = gesture.list.getBoundingClientRect()
  const width = gesture.clone.offsetWidth
  const height = gesture.clone.offsetHeight
  gesture.clone.style.left = `${clamp(gesture.lastX - gesture.offsetX, listRect.left, listRect.right - width)}px`
  gesture.clone.style.top = `${clamp(gesture.lastY - gesture.offsetY, listRect.top, listRect.bottom - height)}px`
}

function updatePlaceholder(gesture: PointerDragGesture) {
  const placeholder = gesture.placeholder
  if (!placeholder) return

  const listRect = gesture.list.getBoundingClientRect()
  if (gesture.lastY < listRect.top || gesture.lastY > listRect.bottom) return

  const pinned = rowPinned(gesture.item)
  const candidates = Array.from(
    gesture.list.querySelectorAll<HTMLElement>(':scope > .note-row[data-reorder-note-id]'),
  ).filter((row) => row !== gesture.item && rowPinned(row) === pinned && row.style.display !== 'none')

  if (candidates.length === 0) return

  for (const row of candidates) {
    const rect = row.getBoundingClientRect()
    if (gesture.lastY < rect.top + rect.height / 2) {
      gesture.list.insertBefore(placeholder, row)
      return
    }
  }

  candidates[candidates.length - 1].insertAdjacentElement('afterend', placeholder)
}

function orderFromPlaceholder(gesture: PointerDragGesture): string[] {
  const ids: string[] = []
  for (const child of Array.from(gesture.list.children)) {
    if (child === gesture.placeholder) {
      ids.push(gesture.noteId)
      continue
    }
    if (!(child instanceof HTMLElement) || child === gesture.item) continue
    const id = child.dataset.reorderNoteId
    if (id) ids.push(id)
  }
  return ids
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

export function NoteListReorderGestureRuntime() {
  useEffect(() => {
    let gesture: PointerDragGesture | null = null
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

    const releasePointer = () => {
      if (!gesture) return
      try {
        if (gesture.list.hasPointerCapture(gesture.pointerId)) {
          gesture.list.releasePointerCapture(gesture.pointerId)
        }
      } catch {
        // Pointer capture can already be gone after cancellation/visibility changes.
      }
    }

    const cleanup = () => {
      if (!gesture) return
      clearTimer()
      stopAutoScroll()
      releasePointer()
      gesture.clone?.remove()
      gesture.placeholder?.remove()
      gesture.item.style.display = gesture.originalDisplay
      gesture.item.removeAttribute('data-oanix-note-dragging')
      document.body.classList.remove('oanix-mobile-note-dragging')
      document.documentElement.classList.remove('oanix-mobile-note-dragging')
      window.getSelection()?.removeAllRanges()
    }

    const cancelGesture = () => {
      cleanup()
      gesture = null
    }

    const startAutoScroll = () => {
      if (!gesture?.dragging || gesture.scrollFrame !== null) return
      const tick = () => {
        if (!gesture?.dragging) return
        const speed = scrollSpeed(gesture.lastY, gesture.list.getBoundingClientRect())
        if (speed !== 0) {
          const before = gesture.list.scrollTop
          gesture.list.scrollTop += speed
          if (gesture.list.scrollTop !== before) {
            positionClone(gesture)
            updatePlaceholder(gesture)
          }
        }
        gesture.scrollFrame = window.requestAnimationFrame(tick)
      }
      gesture.scrollFrame = window.requestAnimationFrame(tick)
    }

    const activateDrag = () => {
      if (!gesture || gesture.dragging || gesture.scrolling) return
      if (document.documentElement.classList.contains('oanix-note-bulk-selecting')) return cancelGesture()

      clearTimer()
      const rect = gesture.item.getBoundingClientRect()
      gesture.offsetX = gesture.lastX - rect.left
      gesture.offsetY = gesture.lastY - rect.top
      gesture.placeholder = createPlaceholder(gesture.item)
      gesture.item.insertAdjacentElement('beforebegin', gesture.placeholder)
      gesture.clone = createClone(gesture.item)
      gesture.originalDisplay = gesture.item.style.display
      gesture.item.style.display = 'none'
      gesture.item.setAttribute('data-oanix-note-dragging', 'true')
      gesture.dragging = true

      document.body.classList.add('oanix-mobile-note-dragging')
      document.documentElement.classList.add('oanix-mobile-note-dragging')
      window.getSelection()?.removeAllRanges()
      positionClone(gesture)
      updatePlaceholder(gesture)
      startAutoScroll()
      navigator.vibrate?.(30)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !event.isPrimary || gesture) return
      if (document.documentElement.classList.contains('oanix-note-bulk-selecting')) return
      if (document.querySelector('.notes-shell--searching')) return

      const item = noteRow(event.target)
      const noteId = item?.dataset.reorderNoteId
      const list = item?.parentElement
      if (!item || !noteId || !list?.classList.contains('notes-list')) return

      gesture = {
        pointerId: event.pointerId,
        item,
        noteId,
        list,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        offsetX: 0,
        offsetY: 0,
        timer: window.setTimeout(activateDrag, LONG_PRESS_MS),
        dragging: false,
        scrolling: false,
        clone: null,
        placeholder: null,
        originalDisplay: item.style.display,
        scrollFrame: null,
      }

      try {
        list.setPointerCapture(event.pointerId)
      } catch {
        cancelGesture()
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.pointerId) return

      const previousY = gesture.lastY
      gesture.lastX = event.clientX
      gesture.lastY = event.clientY

      if (event.cancelable) event.preventDefault()
      event.stopPropagation()

      if (!gesture.dragging) {
        const distance = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY)
        if (!gesture.scrolling && distance >= MOVE_CANCEL_PX) {
          clearTimer()
          gesture.scrolling = true
        }
        if (gesture.scrolling) {
          const before = gesture.list.scrollTop
          gesture.list.scrollTop -= event.clientY - previousY
          if (gesture.list.scrollTop !== before) suppressClickUntil = performance.now() + 320
        }
        return
      }

      positionClone(gesture)
      updatePlaceholder(gesture)
    }

    const finishGesture = async (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.pointerId) return

      if (event.cancelable) event.preventDefault()
      event.stopPropagation()

      if (!gesture.dragging) {
        if (gesture.scrolling) suppressClickUntil = performance.now() + 320
        cleanup()
        gesture = null
        return
      }

      suppressClickUntil = performance.now() + 520

      const finished = gesture
      const nextOrder = orderFromPlaceholder(finished)
      const beforeOrder = Array.from(finished.list.querySelectorAll<HTMLElement>(':scope > .note-row[data-reorder-note-id]'))
        .flatMap((row) => row.dataset.reorderNoteId ? [row.dataset.reorderNoteId] : [])

      cleanup()
      gesture = null

      if (event.type === 'pointercancel' || nextOrder.length !== beforeOrder.length || nextOrder.join('|') === beforeOrder.join('|')) return

      try {
        await persistNoteOrder(nextOrder)
        window.dispatchEvent(new CustomEvent('oanix:local-data-changed', { detail: { recordType: 'note' } }))
        window.dispatchEvent(new Event('oanix:workspace-refresh'))
        navigator.vibrate?.(12)
      } catch {
        window.dispatchEvent(new Event('oanix:workspace-refresh'))
      }
    }

    const onLostPointerCapture = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.pointerId) return
      cancelGesture()
    }

    const onClick = (event: MouseEvent) => {
      if (performance.now() >= suppressClickUntil || !noteRow(event.target)) return
      event.preventDefault()
      event.stopImmediatePropagation()
    }

    const blockNative = (event: Event) => {
      if (!noteRow(event.target)) return
      event.preventDefault()
    }

    const onVisibilityChange = () => { if (document.hidden) cancelGesture() }
    const onBlur = () => cancelGesture()

    document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true })
    document.addEventListener('pointermove', onPointerMove, { capture: true, passive: false })
    document.addEventListener('pointerup', finishGesture, { capture: true, passive: false })
    document.addEventListener('pointercancel', finishGesture, { capture: true, passive: false })
    document.addEventListener('lostpointercapture', onLostPointerCapture, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('contextmenu', blockNative, true)
    document.addEventListener('selectstart', blockNative, true)
    document.addEventListener('dragstart', blockNative, true)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)

    return () => {
      cancelGesture()
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointermove', onPointerMove, true)
      document.removeEventListener('pointerup', finishGesture, true)
      document.removeEventListener('pointercancel', finishGesture, true)
      document.removeEventListener('lostpointercapture', onLostPointerCapture, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('contextmenu', blockNative, true)
      document.removeEventListener('selectstart', blockNative, true)
      document.removeEventListener('dragstart', blockNative, true)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
      document.body.classList.remove('oanix-mobile-note-dragging')
      document.documentElement.classList.remove('oanix-mobile-note-dragging')
    }
  }, [])

  return null
}
