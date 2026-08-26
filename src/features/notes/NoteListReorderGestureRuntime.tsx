import { useEffect } from 'react'
import Sortable from 'sortablejs'
import { persistNoteOrder } from './noteService'
import './noteReorderGesture.css'

const LONG_PRESS_MS = 300
const TOUCH_START_THRESHOLD_PX = 7
const TOUCH_MOVE_CANCEL_PX = 12
const PRESS_ARM_GRACE_MS = 55
const EDGE_SCROLL_PX = 76
const MAX_SCROLL_PER_FRAME = 10
const REFLOW_MS = 180

type SortableOptionsWithHandle = NonNullable<Parameters<typeof Sortable.create>[1]> & { handle: string }
type DragIdentity = { cardColor: string; tabColor: string; icon: string | null }
type ClientPoint = { x: number; y: number }
type TouchGesture = {
  source: 'pointer' | 'touch'
  pointerId: number
  item: HTMLElement
  startX: number
  startY: number
  lastX: number
  lastY: number
  pressedAt: number
  grabOffsetX: number
  grabOffsetY: number
  moved: boolean
  dragging: boolean
  orderBefore: string[]
  timer: number | null
  scrollFrame: number | null
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
function interactionBlocked(): boolean {
  return document.documentElement.classList.contains('oanix-note-bulk-selecting') || Boolean(document.querySelector('.notes-shell--searching'))
}
function isExcludedInteractiveTarget(target: HTMLElement): boolean {
  return Boolean(target.closest('.note-row__menu-wrap, button:not(.note-row__open), a, input, textarea, select, [contenteditable="true"]'))
}
function eventClientPoint(event: Event | undefined): ClientPoint | null {
  if (!event) return null
  if (event instanceof TouchEvent) {
    const touch = event.touches[0] ?? event.changedTouches[0]
    return touch ? { x: touch.clientX, y: touch.clientY } : null
  }
  if (event instanceof MouseEvent) return { x: event.clientX, y: event.clientY }
  return null
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
function copyComputedStyleTree(source: HTMLElement, target: HTMLElement) {
  const style = window.getComputedStyle(source)
  for (let index = 0; index < style.length; index += 1) {
    const property = style.item(index)
    if (!property) continue
    target.style.setProperty(property, style.getPropertyValue(property), 'important')
  }
  const sourceChildren = Array.from(source.children)
  const targetChildren = Array.from(target.children)
  sourceChildren.forEach((sourceChild, index) => {
    const targetChild = targetChildren[index]
    if (sourceChild instanceof HTMLElement && targetChild instanceof HTMLElement) copyComputedStyleTree(sourceChild, targetChild)
  })
}
function prepareDragOverlayTemplate(row: HTMLElement): HTMLElement {
  const clone = row.cloneNode(true) as HTMLElement
  copyComputedStyleTree(row, clone)
  clone.removeAttribute('data-oanix-note-dragging')
  clone.removeAttribute('data-reorder-note-id')
  clone.className = 'oanix-mobile-note-drag-overlay'
  clone.querySelector<HTMLElement>('.note-row__menu-wrap')?.remove()
  clone.setAttribute('aria-hidden', 'true')
  return clone
}
function snapshotRects(list: HTMLElement): Map<HTMLElement, DOMRect> {
  return new Map(
    Array.from(list.querySelectorAll<HTMLElement>(':scope > .note-row[data-reorder-note-id]'))
      .map((row) => [row, row.getBoundingClientRect()] as const),
  )
}
function animateReflow(list: HTMLElement, before: Map<HTMLElement, DOMRect>, dragged: HTMLElement) {
  for (const row of Array.from(list.querySelectorAll<HTMLElement>(':scope > .note-row[data-reorder-note-id]'))) {
    if (row === dragged) continue
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
function scrollSpeed(clientY: number): number {
  if (clientY < EDGE_SCROLL_PX) {
    const strength = Math.min(1, (EDGE_SCROLL_PX - clientY) / EDGE_SCROLL_PX)
    return -Math.max(2, Math.round(MAX_SCROLL_PER_FRAME * strength))
  }
  if (clientY > window.innerHeight - EDGE_SCROLL_PX) {
    const strength = Math.min(1, (clientY - (window.innerHeight - EDGE_SCROLL_PX)) / EDGE_SCROLL_PX)
    return Math.max(2, Math.round(MAX_SCROLL_PER_FRAME * strength))
  }
  return 0
}

export function NoteListReorderGestureRuntime() {
  useEffect(() => {
    let suppressClickUntil = 0
    let dragOverlay: HTMLElement | null = null
    let dragOverlayTemplate: HTMLElement | null = null
    let dragOverlayOffset: ClientPoint | null = null
    let lastPointer: ClientPoint | null = null
    let touchGesture: TouchGesture | null = null
    const dragIdentityById = new Map<string, DragIdentity>()
    const list = document.querySelector<HTMLElement>('.notes-list')
    if (!list?.classList.contains('notes-list')) return
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
    const nativeTouchEvents = typeof TouchEvent !== 'undefined'
    const noteRows = () => Array.from(list.querySelectorAll<HTMLElement>(':scope > .note-row[data-reorder-note-id]'))

    const freezeDragIdentity = () => {
      dragIdentityById.clear()
      noteRows().forEach((row) => {
        const noteId = row.dataset.reorderNoteId
        if (!noteId) return
        const style = window.getComputedStyle(row)
        const cardColor = row.style.getPropertyValue('--oanix-note-card-color').trim() || style.getPropertyValue('--oanix-note-card-color').trim()
        const tabColor = row.style.getPropertyValue('--oanix-note-tab-color').trim() || style.getPropertyValue('--oanix-note-tab-color').trim()
        const avatar = row.querySelector<HTMLElement>('.note-row__avatar')
        dragIdentityById.set(noteId, { cardColor, tabColor, icon: avatar?.dataset.oanixNoteIcon ?? null })
        if (cardColor) row.style.setProperty('--oanix-note-drag-stable-card-color', cardColor)
        if (tabColor) row.style.setProperty('--oanix-note-drag-stable-tab-color', tabColor)
      })
    }
    const restoreDragIdentity = () => {
      noteRows().forEach((row) => {
        const noteId = row.dataset.reorderNoteId
        const identity = noteId ? dragIdentityById.get(noteId) : null
        if (!identity) return
        if (identity.cardColor) row.style.setProperty('--oanix-note-card-color', identity.cardColor)
        if (identity.tabColor) row.style.setProperty('--oanix-note-tab-color', identity.tabColor)
        const avatar = row.querySelector<HTMLElement>('.note-row__avatar')
        if (avatar && identity.icon) avatar.dataset.oanixNoteIcon = identity.icon
      })
    }
    const clearFrozenDragIdentity = () => {
      noteRows().forEach((row) => {
        row.style.removeProperty('--oanix-note-drag-stable-card-color')
        row.style.removeProperty('--oanix-note-drag-stable-tab-color')
      })
      dragIdentityById.clear()
    }
    const removeDragOverlay = () => {
      dragOverlay?.remove()
      dragOverlay = null
      dragOverlayOffset = null
    }
    const positionDragOverlay = (point: ClientPoint) => {
      if (!dragOverlay || !dragOverlayOffset) return
      dragOverlay.style.setProperty('left', `${point.x - dragOverlayOffset.x}px`, 'important')
      dragOverlay.style.setProperty('top', `${point.y - dragOverlayOffset.y}px`, 'important')
    }
    const createDragOverlay = (row: HTMLElement, point: ClientPoint | null) => {
      removeDragOverlay()
      const rect = row.getBoundingClientRect()
      const clone = dragOverlayTemplate ?? prepareDragOverlayTemplate(row)
      dragOverlayTemplate = null
      clone.style.setProperty('position', 'fixed', 'important')
      clone.style.setProperty('z-index', '2147483000', 'important')
      clone.style.setProperty('margin', '0', 'important')
      clone.style.setProperty('box-sizing', 'border-box', 'important')
      clone.style.setProperty('pointer-events', 'none', 'important')
      clone.style.setProperty('visibility', 'visible', 'important')
      clone.style.setProperty('opacity', '.99', 'important')
      clone.style.setProperty('display', window.getComputedStyle(row).display || 'grid', 'important')
      clone.style.setProperty('width', `${rect.width}px`, 'important')
      clone.style.setProperty('min-width', `${rect.width}px`, 'important')
      clone.style.setProperty('max-width', `${rect.width}px`, 'important')
      clone.style.setProperty('height', `${rect.height}px`, 'important')
      clone.style.setProperty('min-height', `${rect.height}px`, 'important')
      clone.style.setProperty('max-height', `${rect.height}px`, 'important')
      clone.style.setProperty('left', `${rect.left}px`, 'important')
      clone.style.setProperty('top', `${rect.top}px`, 'important')
      clone.style.setProperty('transform', 'scale(1.015)', 'important')
      clone.style.setProperty('transform-origin', 'center center', 'important')
      clone.style.setProperty('overflow', 'hidden', 'important')
      clone.style.setProperty('background', 'rgba(18,18,35,.96)', 'important')
      clone.style.setProperty('border', '1px solid rgba(255,255,255,.20)', 'important')
      clone.style.setProperty('border-radius', '1rem', 'important')
      clone.style.setProperty('box-shadow', '0 22px 46px rgba(2,6,23,.46), 0 0 0 2px rgba(96,165,250,.30)', 'important')
      document.body.appendChild(clone)
      dragOverlay = clone
      const anchor = point ?? lastPointer ?? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      dragOverlayOffset = {
        x: Math.min(rect.width, Math.max(0, anchor.x - rect.left)),
        y: Math.min(rect.height, Math.max(0, anchor.y - rect.top)),
      }
      positionDragOverlay(anchor)
    }
    const clearDragVisuals = () => {
      removeDragOverlay()
      dragOverlayTemplate = null
      restoreDragIdentity()
      document.body.classList.remove('oanix-mobile-note-dragging')
      document.documentElement.classList.remove('oanix-mobile-note-dragging')
      list.querySelectorAll<HTMLElement>('[data-oanix-note-dragging="true"]').forEach((row) => row.removeAttribute('data-oanix-note-dragging'))
      list.querySelectorAll<HTMLElement>('.oanix-mobile-note-placeholder').forEach((row) => row.classList.remove('oanix-mobile-note-placeholder'))
      list.querySelectorAll<HTMLElement>('.oanix-mobile-note-chosen').forEach((row) => row.classList.remove('oanix-mobile-note-chosen'))
      clearFrozenDragIdentity()
      clearDraggedRowSurface()
      window.getSelection()?.removeAllRanges()
    }
    const persistCurrentOrder = async (nextOrder: string[]) => {
      if (nextOrder.length === 0) return
      try {
        const updatedNotes = await persistNoteOrder(nextOrder)
        window.dispatchEvent(new CustomEvent('oanix:note-order-persisted', { detail: { notes: updatedNotes.map((note) => ({ id: note.id, manualOrder: note.manualOrder })) } }))
        window.dispatchEvent(new CustomEvent('oanix:local-data-changed', { detail: { recordType: 'note' } }))
        navigator.vibrate?.(12)
      } catch {
        window.dispatchEvent(new Event('oanix:workspace-refresh'))
      }
    }

    const reorderTouchDomAtPoint = (gesture: TouchGesture, animate = true) => {
      const draggedPinned = rowPinned(gesture.item)
      const all = noteRows().filter((row) => row !== gesture.item)
      const eligible = all.filter((row) => rowPinned(row) === draggedPinned)
      const beforeOrder = noteOrder(list).join('|')
      const beforeRects = animate ? snapshotRects(list) : null
      const insertionTarget = eligible.find((row) => {
        const rect = row.getBoundingClientRect()
        return gesture.lastY < rect.top + rect.height / 2
      })

      if (insertionTarget) {
        list.insertBefore(gesture.item, insertionTarget)
      } else if (draggedPinned) {
        const firstUnpinned = all.find((row) => !rowPinned(row))
        if (firstUnpinned) list.insertBefore(gesture.item, firstUnpinned)
        else list.appendChild(gesture.item)
      } else {
        list.appendChild(gesture.item)
      }

      const changed = noteOrder(list).join('|') !== beforeOrder
      if (!changed || !beforeRects) return
      animateReflow(list, beforeRects, gesture.item)
    }
    const stopTouchAutoScroll = () => {
      if (!touchGesture || touchGesture.scrollFrame === null) return
      window.cancelAnimationFrame(touchGesture.scrollFrame)
      touchGesture.scrollFrame = null
    }
    const startTouchAutoScroll = () => {
      if (!touchGesture || !touchGesture.dragging || touchGesture.scrollFrame !== null) return
      const tick = () => {
        if (!touchGesture || !touchGesture.dragging) return
        const speed = scrollSpeed(touchGesture.lastY)
        if (speed !== 0) {
          const before = list.scrollTop
          list.scrollTop += speed
          if (list.scrollTop !== before) {
            reorderTouchDomAtPoint(touchGesture, false)
          } else {
            window.scrollBy(0, speed)
            reorderTouchDomAtPoint(touchGesture, false)
          }
        }
        touchGesture.scrollFrame = window.requestAnimationFrame(tick)
      }
      touchGesture.scrollFrame = window.requestAnimationFrame(tick)
    }
    const clearTouchTimer = () => {
      if (!touchGesture || touchGesture.timer === null) return
      window.clearTimeout(touchGesture.timer)
      touchGesture.timer = null
    }
    const beginTouchDrag = () => {
      if (!touchGesture || touchGesture.moved || touchGesture.dragging || interactionBlocked()) return
      clearTouchTimer()
      touchGesture.dragging = true
      touchGesture.orderBefore = noteOrder(list)
      freezeDragIdentity()
      dragOverlayTemplate = prepareDragOverlayTemplate(touchGesture.item)
      exposeDraggedRowSurface(touchGesture.item)
      touchGesture.item.setAttribute('data-oanix-note-dragging', 'true')
      document.body.classList.add('oanix-mobile-note-dragging')
      document.documentElement.classList.add('oanix-mobile-note-dragging')
      createDragOverlay(touchGesture.item, { x: touchGesture.lastX, y: touchGesture.lastY })
      touchGesture.item.classList.add('oanix-mobile-note-chosen', 'oanix-mobile-note-placeholder')
      positionDragOverlay({ x: touchGesture.lastX, y: touchGesture.lastY })
      startTouchAutoScroll()
      window.getSelection()?.removeAllRanges()
      navigator.vibrate?.(30)
    }
    const cancelTouchGesture = (restoreOrder = true) => {
      if (!touchGesture) return
      clearTouchTimer()
      stopTouchAutoScroll()
      if (restoreOrder && touchGesture.dragging && touchGesture.orderBefore.length) restoreDomOrder(list, touchGesture.orderBefore)
      touchGesture = null
      clearDragVisuals()
    }
    const beginGesture = (source: 'pointer' | 'touch', pointerId: number, item: HTMLElement, clientX: number, clientY: number) => {
      const rect = item.getBoundingClientRect()
      lastPointer = { x: clientX, y: clientY }
      touchGesture = {
        source,
        pointerId,
        item,
        startX: clientX,
        startY: clientY,
        lastX: clientX,
        lastY: clientY,
        pressedAt: performance.now(),
        grabOffsetX: clientX - rect.left,
        grabOffsetY: clientY - rect.top,
        moved: false,
        dragging: false,
        orderBefore: [],
        timer: window.setTimeout(beginTouchDrag, LONG_PRESS_MS),
        scrollFrame: null,
      }
    }
    const advanceGesture = (clientX: number, clientY: number, preventDefault: () => void) => {
      if (!touchGesture) return
      touchGesture.lastX = clientX
      touchGesture.lastY = clientY
      lastPointer = { x: clientX, y: clientY }

      if (!touchGesture.dragging) {
        const dx = clientX - touchGesture.startX
        const dy = clientY - touchGesture.startY
        const distance = Math.hypot(dx, dy)
        if (distance < TOUCH_MOVE_CANCEL_PX) return

        const heldFor = performance.now() - touchGesture.pressedAt
        if (heldFor >= LONG_PRESS_MS - PRESS_ARM_GRACE_MS) {
          beginTouchDrag()
          if (touchGesture?.dragging) {
            preventDefault()
            positionDragOverlay(lastPointer)
            reorderTouchDomAtPoint(touchGesture)
            return
          }
        }

        touchGesture.moved = true
        clearTouchTimer()
        return
      }

      preventDefault()
      positionDragOverlay(lastPointer)
      reorderTouchDomAtPoint(touchGesture)
    }
    const completeGesture = (preventDefault: () => void) => {
      if (!touchGesture) return
      const finished = touchGesture
      clearTouchTimer()
      stopTouchAutoScroll()

      if (!finished.dragging) {
        if (finished.moved) suppressClickUntil = performance.now() + 380
        touchGesture = null
        return
      }

      preventDefault()
      suppressClickUntil = performance.now() + 520
      const nextOrder = noteOrder(list)
      const changed = nextOrder.join('|') !== finished.orderBefore.join('|')
      touchGesture = null
      clearDragVisuals()
      if (changed) void persistCurrentOrder(nextOrder)
    }

    const onTouchPointerDown = (event: PointerEvent) => {
      if (!coarsePointer || event.pointerType === 'mouse' || event.button !== 0 || touchGesture || interactionBlocked()) return
      if (nativeTouchEvents && event.pointerType === 'touch') return
      if (!(event.target instanceof HTMLElement) || isExcludedInteractiveTarget(event.target)) return
      const item = event.target.closest<HTMLElement>('.note-row[data-reorder-note-id]')
      if (!item || item.parentElement !== list) return
      beginGesture('pointer', event.pointerId, item, event.clientX, event.clientY)
    }
    const onTouchPointerMove = (event: PointerEvent) => {
      if (!touchGesture || touchGesture.source !== 'pointer' || event.pointerId !== touchGesture.pointerId) return
      advanceGesture(event.clientX, event.clientY, () => event.preventDefault())
    }
    const finishPointerGesture = (event: PointerEvent) => {
      if (!touchGesture || touchGesture.source !== 'pointer' || event.pointerId !== touchGesture.pointerId) return
      completeGesture(() => event.preventDefault())
    }
    const touchForGesture = (event: TouchEvent): Touch | null => {
      if (!touchGesture || touchGesture.source !== 'touch') return null
      return Array.from(event.touches).find((touch) => touch.identifier === touchGesture?.pointerId)
        ?? Array.from(event.changedTouches).find((touch) => touch.identifier === touchGesture?.pointerId)
        ?? null
    }
    const onNativeTouchStart = (event: TouchEvent) => {
      if (!coarsePointer || touchGesture || interactionBlocked()) return
      if (!(event.target instanceof HTMLElement) || isExcludedInteractiveTarget(event.target)) return
      const item = event.target.closest<HTMLElement>('.note-row[data-reorder-note-id]')
      const touch = event.changedTouches[0]
      if (!item || item.parentElement !== list || !touch) return
      beginGesture('touch', touch.identifier, item, touch.clientX, touch.clientY)
    }
    const onNativeTouchMove = (event: TouchEvent) => {
      const touch = touchForGesture(event)
      if (!touch) return
      advanceGesture(touch.clientX, touch.clientY, () => event.preventDefault())
    }
    const finishNativeTouchGesture = (event: TouchEvent) => {
      if (!touchGesture || touchGesture.source !== 'touch') return
      const ended = Array.from(event.changedTouches).some((touch) => touch.identifier === touchGesture?.pointerId)
      if (!ended) return
      completeGesture(() => event.preventDefault())
    }

    const sortableOptions: SortableOptionsWithHandle = {
      draggable: '.note-row[data-reorder-note-id]',
      handle: '.note-row[data-reorder-note-id]',
      filter: (_event, target) => interactionBlocked() || isExcludedInteractiveTarget(target),
      preventOnFilter: false,
      disabled: coarsePointer,
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
        freezeDragIdentity()
        dragOverlayTemplate = prepareDragOverlayTemplate(event.item)
        event.item.setAttribute('data-oanix-note-dragging', 'true')
        exposeDraggedRowSurface(event.item)
        window.getSelection()?.removeAllRanges()
      },
      onStart: (event) => {
        exposeDraggedRowSurface(event.item)
        document.body.classList.add('oanix-mobile-note-dragging')
        document.documentElement.classList.add('oanix-mobile-note-dragging')
        createDragOverlay(event.item, lastPointer)
        navigator.vibrate?.(30)
      },
      onMove: (event) => {
        if (interactionBlocked()) return false
        return rowPinned(event.dragged) === rowPinned(event.related)
      },
      onEnd: (event) => {
        suppressClickUntil = performance.now() + 520
        const nextOrder = noteOrder(event.to)
        clearDragVisuals()
        if (event.oldIndex === event.newIndex || nextOrder.length === 0) return
        void persistCurrentOrder(nextOrder)
      },
    }

    const sortable = Sortable.create(list, sortableOptions)
    const rememberPointer = (event: TouchEvent | PointerEvent) => {
      const point = eventClientPoint(event)
      if (!point) return
      lastPointer = point
      if (!touchGesture?.dragging) positionDragOverlay(point)
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
    const onTouchPointerCancel = (event: PointerEvent) => {
      if (!touchGesture || touchGesture.source !== 'pointer' || event.pointerId !== touchGesture.pointerId) return
      cancelTouchGesture(true)
    }
    const onNativeTouchCancel = (event: TouchEvent) => {
      if (!touchGesture || touchGesture.source !== 'touch') return
      const cancelled = Array.from(event.changedTouches).some((touch) => touch.identifier === touchGesture?.pointerId)
      if (cancelled) cancelTouchGesture(true)
    }
    const onVisibilityChange = () => {
      if (document.hidden) cancelTouchGesture(true)
    }
    const onBlur = () => cancelTouchGesture(true)

    document.addEventListener('touchstart', rememberPointer, { capture: true, passive: true })
    document.addEventListener('touchmove', rememberPointer, { capture: true, passive: true })
    document.addEventListener('pointerdown', rememberPointer, { capture: true, passive: true })
    document.addEventListener('pointermove', rememberPointer, { capture: true, passive: true })
    document.addEventListener('touchstart', onNativeTouchStart, { capture: true, passive: true })
    document.addEventListener('touchmove', onNativeTouchMove, { capture: true, passive: false })
    document.addEventListener('touchend', finishNativeTouchGesture, { capture: true, passive: false })
    document.addEventListener('touchcancel', onNativeTouchCancel, true)
    document.addEventListener('pointerdown', onTouchPointerDown, true)
    document.addEventListener('pointermove', onTouchPointerMove, { capture: true, passive: false })
    document.addEventListener('pointerup', finishPointerGesture, true)
    document.addEventListener('pointercancel', onTouchPointerCancel, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('contextmenu', blockNativeLongPress, true)
    document.addEventListener('selectstart', blockNativeLongPress, true)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)

    return () => {
      sortable.destroy()
      cancelTouchGesture(true)
      clearDragVisuals()
      document.removeEventListener('touchstart', rememberPointer, true)
      document.removeEventListener('touchmove', rememberPointer, true)
      document.removeEventListener('pointerdown', rememberPointer, true)
      document.removeEventListener('pointermove', rememberPointer, true)
      document.removeEventListener('touchstart', onNativeTouchStart, true)
      document.removeEventListener('touchmove', onNativeTouchMove, true)
      document.removeEventListener('touchend', finishNativeTouchGesture, true)
      document.removeEventListener('touchcancel', onNativeTouchCancel, true)
      document.removeEventListener('pointerdown', onTouchPointerDown, true)
      document.removeEventListener('pointermove', onTouchPointerMove, true)
      document.removeEventListener('pointerup', finishPointerGesture, true)
      document.removeEventListener('pointercancel', onTouchPointerCancel, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('contextmenu', blockNativeLongPress, true)
      document.removeEventListener('selectstart', blockNativeLongPress, true)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
    }
  }, [])
  return null
}