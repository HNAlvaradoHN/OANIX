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

  useEffect(() => {
    const existing = document.getElementById('oanix-note-drag-debug')
    existing?.remove()

    const button = document.createElement('button')
    button.id = 'oanix-note-drag-debug'
    button.type = 'button'
    button.textContent = '🔍 Drag logs'
    button.setAttribute('aria-label', 'Abrir diagnóstico del arrastre de notas')
    button.style.cssText = [
      'position:fixed',
      'right:14px',
      'bottom:calc(92px + env(safe-area-inset-bottom))',
      'z-index:99990',
      'padding:10px 12px',
      'border:1px solid rgba(103,232,249,.9)',
      'border-radius:10px',
      'background:rgba(2,6,23,.94)',
      'color:#e0f2fe',
      'font:600 12px/1.2 system-ui,sans-serif',
      'box-shadow:0 8px 24px rgba(2,6,23,.4)',
      'touch-action:manipulation',
    ].join(';')

    const closeModal = () => document.getElementById('oanix-note-drag-debug-modal')?.remove()

    button.addEventListener('click', () => {
      closeModal()
      const traceWindow = window as WindowWithDragTrace
      const entries = traceWindow.__OANIX_NOTE_DRAG_TRACE__ ?? []
      const output = entries.length > 0
        ? entries.map((entry, index) => `${index + 1}. ${JSON.stringify(entry)}`).join('\n\n')
        : 'No hay eventos todavía. Intenta arrastrar una nota desde el avatar y vuelve a abrir este visor.'

      const modal = document.createElement('div')
      modal.id = 'oanix-note-drag-debug-modal'
      modal.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:99999',
        'background:rgba(2,6,23,.94)',
        'padding:calc(18px + env(safe-area-inset-top)) 14px calc(18px + env(safe-area-inset-bottom))',
        'overflow:auto',
        'color:#f8fafc',
      ].join(';')

      const panel = document.createElement('section')
      panel.style.cssText = 'max-width:720px;margin:0 auto;background:#0f172a;border:1px solid rgba(103,232,249,.75);border-radius:14px;padding:14px;box-shadow:0 20px 60px rgba(0,0,0,.45)'

      const header = document.createElement('div')
      header.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:12px'

      const title = document.createElement('strong')
      title.textContent = `Drag logs · ${entries.length} eventos`
      title.style.cssText = 'color:#67e8f9;font:700 14px system-ui,sans-serif'

      const actions = document.createElement('div')
      actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end'

      const copy = document.createElement('button')
      copy.type = 'button'
      copy.textContent = 'Copiar'
      copy.style.cssText = 'padding:8px 10px;border:0;border-radius:8px;background:#0891b2;color:white;font-weight:700'
      copy.addEventListener('click', () => {
        void navigator.clipboard.writeText(output).then(() => {
          copy.textContent = 'Copiado ✓'
        }).catch(() => {
          copy.textContent = 'No se pudo copiar'
        })
      })

      const clear = document.createElement('button')
      clear.type = 'button'
      clear.textContent = 'Limpiar'
      clear.style.cssText = 'padding:8px 10px;border:1px solid #475569;border-radius:8px;background:#1e293b;color:#e2e8f0;font-weight:700'
      clear.addEventListener('click', () => {
        traceWindow.__OANIX_NOTE_DRAG_TRACE__ = []
        closeModal()
      })

      const close = document.createElement('button')
      close.type = 'button'
      close.textContent = 'Cerrar'
      close.style.cssText = 'padding:8px 10px;border:0;border-radius:8px;background:#dc2626;color:white;font-weight:700'
      close.addEventListener('click', closeModal)

      const pre = document.createElement('pre')
      pre.textContent = output
      pre.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;margin:0;max-height:70dvh;overflow:auto;padding:12px;border-radius:10px;background:#020617;color:#cbd5e1;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace'

      actions.append(copy, clear, close)
      header.append(title, actions)
      panel.append(header, pre)
      modal.append(panel)
      document.body.append(modal)
    })

    document.body.append(button)

    return () => {
      button.remove()
      closeModal()
    }
  }, [])

  return null
}
