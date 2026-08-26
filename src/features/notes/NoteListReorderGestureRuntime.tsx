import { useEffect } from 'react'
import Sortable from 'sortablejs'
import { persistNoteOrder } from './noteService'
import './noteReorderGesture.css'

const LONG_PRESS_MS = 300
const TOUCH_START_THRESHOLD_PX = 7

type SortableOptionsWithHandle = NonNullable<Parameters<typeof Sortable.create>[1]> & { handle: string }
type DragIdentity = { cardColor: string; tabColor: string; icon: string | null }
type ClientPoint = { x: number; y: number }

function rowPinned(row: HTMLElement): boolean {
  const title = row.querySelector<HTMLElement>('.note-row__topline > strong')
  return Boolean(title?.textContent?.trim().startsWith('📌'))
}
function noteOrder(list: HTMLElement): string[] {
  return Array.from(list.querySelectorAll<HTMLElement>(':scope > .note-row[data-reorder-note-id]')).flatMap((row) => row.dataset.reorderNoteId ? [row.dataset.reorderNoteId] : [])
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
  clone.classList.remove('oanix-mobile-note-placeholder', 'oanix-mobile-note-chosen', 'oanix-mobile-note-drag-source', 'oanix-mobile-note-drag-ghost')
  clone.classList.add('oanix-mobile-note-drag-overlay')
  clone.setAttribute('aria-hidden', 'true')
  return clone
}

export function NoteListReorderGestureRuntime() {
  useEffect(() => {
    let suppressClickUntil = 0
    let dragOverlay: HTMLElement | null = null
    let dragOverlayTemplate: HTMLElement | null = null
    let dragOverlayOffset: ClientPoint | null = null
    let lastPointer: ClientPoint | null = null
    const dragIdentityById = new Map<string, DragIdentity>()
    const list = document.querySelector<HTMLElement>('.notes-list')
    if (!list?.classList.contains('notes-list')) return
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
      clearFrozenDragIdentity()
      clearDraggedRowSurface()
      window.getSelection()?.removeAllRanges()
    }

    const sortableOptions: SortableOptionsWithHandle = {
      draggable: '.note-row[data-reorder-note-id]',
      handle: '.note-row[data-reorder-note-id]',
      filter: (_event, target) => interactionBlocked() || isExcludedInteractiveTarget(target),
      preventOnFilter: false,
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
        void (async () => {
          try {
            const updatedNotes = await persistNoteOrder(nextOrder)
            window.dispatchEvent(new CustomEvent('oanix:note-order-persisted', { detail: { notes: updatedNotes.map((note) => ({ id: note.id, manualOrder: note.manualOrder })) } }))
            window.dispatchEvent(new CustomEvent('oanix:local-data-changed', { detail: { recordType: 'note' } }))
            navigator.vibrate?.(12)
          } catch {
            window.dispatchEvent(new Event('oanix:workspace-refresh'))
          }
        })()
      },
    }

    const sortable = Sortable.create(list, sortableOptions)
    const rememberPointer = (event: TouchEvent | PointerEvent) => {
      const point = eventClientPoint(event)
      if (!point) return
      lastPointer = point
      positionDragOverlay(point)
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

    document.addEventListener('touchstart', rememberPointer, { capture: true, passive: true })
    document.addEventListener('touchmove', rememberPointer, { capture: true, passive: true })
    document.addEventListener('pointerdown', rememberPointer, { capture: true, passive: true })
    document.addEventListener('pointermove', rememberPointer, { capture: true, passive: true })
    document.addEventListener('click', onClick, true)
    document.addEventListener('contextmenu', blockNativeLongPress, true)
    document.addEventListener('selectstart', blockNativeLongPress, true)
    return () => {
      sortable.destroy()
      clearDragVisuals()
      document.removeEventListener('touchstart', rememberPointer, true)
      document.removeEventListener('touchmove', rememberPointer, true)
      document.removeEventListener('pointerdown', rememberPointer, true)
      document.removeEventListener('pointermove', rememberPointer, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('contextmenu', blockNativeLongPress, true)
      document.removeEventListener('selectstart', blockNativeLongPress, true)
    }
  }, [])
  return null
}
