import { useEffect } from 'react'
import Sortable from 'sortablejs'
import { persistNoteOrder } from './noteService'
import './noteReorderGesture.css'

const LONG_PRESS_MS = 300
const TOUCH_START_THRESHOLD_PX = 7
const MOVE_LOG_INTERVAL_MS = 100
const MAX_DRAG_TRACE_ENTRIES = 120

type SortableOptionsWithHandle = NonNullable<Parameters<typeof Sortable.create>[1]> & {
  handle: string
}

type DragTraceEntry = {
  at: number
  stage: string
  detail?: Record<string, unknown>
}

type WindowWithDragTrace = Window & {
  __OANIX_NOTE_DRAG_TRACE__?: DragTraceEntry[]
}

function rowPinned(row: HTMLElement): boolean {
  const title = row.querySelector<HTMLElement>('.note-row__topline > strong')
  return Boolean(title?.textContent?.trim().startsWith('📌'))
}

function noteOrder(list: HTMLElement): string[] {
  return Array.from(list.querySelectorAll<HTMLElement>(':scope > .note-row[data-reorder-note-id]'))
    .flatMap((row) => row.dataset.reorderNoteId ? [row.dataset.reorderNoteId] : [])
}

function interactionBlocked(): boolean {
  return document.documentElement.classList.contains('oanix-note-bulk-selecting')
    || Boolean(document.querySelector('.notes-shell--searching'))
}

function isInteractiveTarget(target: HTMLElement): boolean {
  return Boolean(target.closest('.note-row__menu-wrap, button, a, input, textarea, select, [contenteditable="true"]'))
}

function isDragHandle(target: HTMLElement): boolean {
  return Boolean(target.closest('.note-row__avatar'))
}

function eventCoordinates(event: Event | undefined): Record<string, unknown> {
  if (!event) return {}
  if (event instanceof PointerEvent) {
    return {
      eventType: event.type,
      x: Math.round(event.clientX),
      y: Math.round(event.clientY),
      pointerType: event.pointerType,
      buttons: event.buttons,
    }
  }
  if (event instanceof TouchEvent) {
    const touch = event.touches[0] ?? event.changedTouches[0]
    return {
      eventType: event.type,
      x: touch ? Math.round(touch.clientX) : null,
      y: touch ? Math.round(touch.clientY) : null,
      touches: event.touches.length,
    }
  }
  if (event instanceof MouseEvent) {
    return {
      eventType: event.type,
      x: Math.round(event.clientX),
      y: Math.round(event.clientY),
      buttons: event.buttons,
    }
  }
  return { eventType: event.type }
}

export function NoteListReorderGestureRuntime() {
  useEffect(() => {
    let suppressClickUntil = 0
    let dragDiagnosticActive = false
    let lastPointerMoveLogAt = 0
    let lastTouchMoveLogAt = 0
    const list = document.querySelector<HTMLElement>('.notes-list')
    if (!list?.classList.contains('notes-list')) return

    const traceWindow = window as WindowWithDragTrace
    traceWindow.__OANIX_NOTE_DRAG_TRACE__ = []

    const trace = (stage: string, detail?: Record<string, unknown>, level: 'info' | 'warn' = 'info') => {
      const entry: DragTraceEntry = {
        at: Math.round(performance.now()),
        stage,
        ...(detail ? { detail } : {}),
      }
      const entries = traceWindow.__OANIX_NOTE_DRAG_TRACE__ ?? []
      entries.push(entry)
      if (entries.length > MAX_DRAG_TRACE_ENTRIES) entries.splice(0, entries.length - MAX_DRAG_TRACE_ENTRIES)
      traceWindow.__OANIX_NOTE_DRAG_TRACE__ = entries
      if (level === 'warn') console.warn('[NOTE_DRAG]', stage, detail ?? '')
      else console.info('[NOTE_DRAG]', stage, detail ?? '')
    }

    const clearDragVisuals = () => {
      document.body.classList.remove('oanix-mobile-note-dragging')
      document.documentElement.classList.remove('oanix-mobile-note-dragging')
      list.querySelectorAll<HTMLElement>('[data-oanix-note-dragging="true"]')
        .forEach((row) => row.removeAttribute('data-oanix-note-dragging'))
      window.getSelection()?.removeAllRanges()
    }

    const sortableOptions: SortableOptionsWithHandle = {
      draggable: ':scope > .note-row[data-reorder-note-id]',
      handle: '.note-row__avatar',
      filter: (_event, target) => interactionBlocked() || (!isDragHandle(target) && isInteractiveTarget(target)),
      preventOnFilter: false,
      direction: 'vertical',
      animation: 165,
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
        trace('choose', {
          noteId: event.item.dataset.reorderNoteId ?? null,
          oldIndex: event.oldIndex ?? null,
        })
        event.item.setAttribute('data-oanix-note-dragging', 'true')
        window.getSelection()?.removeAllRanges()
      },
      onStart: (event) => {
        dragDiagnosticActive = true
        lastPointerMoveLogAt = 0
        lastTouchMoveLogAt = 0
        trace('start', {
          noteId: event.item.dataset.reorderNoteId ?? null,
          oldIndex: event.oldIndex ?? null,
        })
        document.body.classList.add('oanix-mobile-note-dragging')
        document.documentElement.classList.add('oanix-mobile-note-dragging')
        navigator.vibrate?.(30)
      },
      onMove: (event) => {
        trace('sortable-move', {
          dragged: event.dragged.dataset.reorderNoteId ?? null,
          related: (event.related as HTMLElement | null)?.dataset?.reorderNoteId ?? null,
        })
        if (interactionBlocked()) return false
        return rowPinned(event.dragged) === rowPinned(event.related)
      },
      onEnd: (event) => {
        trace('end', {
          noteId: event.item.dataset.reorderNoteId ?? null,
          oldIndex: event.oldIndex ?? null,
          newIndex: event.newIndex ?? null,
        })
        dragDiagnosticActive = false
        suppressClickUntil = performance.now() + 520
        clearDragVisuals()
        const nextOrder = noteOrder(event.to)

        if (event.oldIndex === event.newIndex || nextOrder.length === 0) return

        void (async () => {
          try {
            await persistNoteOrder(nextOrder)
            window.dispatchEvent(new CustomEvent('oanix:local-data-changed', { detail: { recordType: 'note' } }))
            window.dispatchEvent(new Event('oanix:workspace-refresh'))
            navigator.vibrate?.(12)
          } catch {
            window.dispatchEvent(new Event('oanix:workspace-refresh'))
          }
        })()
      },
    }

    const sortable = Sortable.create(list, sortableOptions)

    const onPointerMoveDiagnostic = (event: PointerEvent) => {
      if (!dragDiagnosticActive) return
      const now = performance.now()
      if (now - lastPointerMoveLogAt < MOVE_LOG_INTERVAL_MS) return
      lastPointerMoveLogAt = now
      trace('pointermove', eventCoordinates(event))
    }

    const onPointerCancelDiagnostic = (event: PointerEvent) => {
      if (!dragDiagnosticActive) return
      trace('pointercancel', eventCoordinates(event), 'warn')
    }

    const onTouchMoveDiagnostic = (event: TouchEvent) => {
      if (!dragDiagnosticActive) return
      const now = performance.now()
      if (now - lastTouchMoveLogAt < MOVE_LOG_INTERVAL_MS) return
      lastTouchMoveLogAt = now
      trace('touchmove', eventCoordinates(event))
    }

    const onTouchCancelDiagnostic = (event: TouchEvent) => {
      if (!dragDiagnosticActive) return
      trace('touchcancel', eventCoordinates(event), 'warn')
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

    document.addEventListener('pointermove', onPointerMoveDiagnostic, true)
    document.addEventListener('pointercancel', onPointerCancelDiagnostic, true)
    document.addEventListener('touchmove', onTouchMoveDiagnostic, true)
    document.addEventListener('touchcancel', onTouchCancelDiagnostic, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('contextmenu', blockNativeLongPress, true)
    document.addEventListener('selectstart', blockNativeLongPress, true)

    return () => {
      sortable.destroy()
      dragDiagnosticActive = false
      clearDragVisuals()
      document.removeEventListener('pointermove', onPointerMoveDiagnostic, true)
      document.removeEventListener('pointercancel', onPointerCancelDiagnostic, true)
      document.removeEventListener('touchmove', onTouchMoveDiagnostic, true)
      document.removeEventListener('touchcancel', onTouchCancelDiagnostic, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('contextmenu', blockNativeLongPress, true)
      document.removeEventListener('selectstart', blockNativeLongPress, true)
    }
  }, [])

  return null
}
