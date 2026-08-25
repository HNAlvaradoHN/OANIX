import { useEffect } from 'react'
import './noteReorderGesture.css'

const NOTE_REORDER_LONG_PRESS_MS = 460
const NOTE_REORDER_MOVE_TOLERANCE = 12

function findReorderToggle(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(
    'button[aria-label="Ordenar notas manualmente"], button[aria-label="Terminar de ordenar notas"]',
  )
}

function reorderModeActive(): boolean {
  return Boolean(document.querySelector('[aria-label^="Orden manual de "]'))
}

function noteIdFromRow(row: HTMLElement): string {
  return row.dataset.reorderNoteId?.trim() ?? ''
}

function syncModeAttribute() {
  const finishing = document.body.hasAttribute('data-oanix-note-drop-finishing')
  document.body.toggleAttribute('data-oanix-note-reorder-mode', !finishing && reorderModeActive())
}

export function NoteListReorderGestureRuntime() {
  useEffect(() => {
    let timer: number | null = null
    let pointerId = -1
    let pointerType = 'touch'
    let startX = 0
    let startY = 0
    let pressedNoteId = ''
    let suppressClickForId = ''
    let gestureDragActive = false
    let dragGhost: HTMLElement | null = null

    const clearTimer = () => {
      if (timer !== null) window.clearTimeout(timer)
      timer = null
    }

    const removeDragGhost = () => {
      dragGhost?.remove()
      dragGhost = null
    }

    const resetPress = () => {
      clearTimer()
      pointerId = -1
      pointerType = 'touch'
      startX = 0
      startY = 0
      pressedNoteId = ''
    }

    const appRoot = document.getElementById('root')
    if (!appRoot) return

    const observer = new MutationObserver(() => window.requestAnimationFrame(syncModeAttribute))
    observer.observe(appRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label'] })
    syncModeAttribute()

    function createDragGhost(noteId: string) {
      removeDragGhost()
      const row = document.querySelector<HTMLElement>(`.note-row[data-reorder-note-id="${CSS.escape(noteId)}"]`)
      if (!row) return
      const rect = row.getBoundingClientRect()
      const clone = row.cloneNode(true) as HTMLElement
      clone.classList.add('oanix-note-drag-ghost')
      clone.removeAttribute('data-reorder-note-id')
      clone.querySelectorAll<HTMLElement>('button, [role="button"]').forEach((element) => {
        element.setAttribute('tabindex', '-1')
      })
      clone.style.left = `${rect.left}px`
      clone.style.top = `${rect.top}px`
      clone.style.width = `${rect.width}px`
      clone.style.height = `${rect.height}px`
      document.body.appendChild(clone)
      dragGhost = clone
    }

    function moveDragGhost(clientX: number, clientY: number) {
      if (!dragGhost) return
      dragGhost.style.transform = `translate3d(${clientX - startX}px, ${clientY - startY}px, 0) scale(1.025)`
    }

    function dispatchDragStart(noteId: string, attempts = 0) {
      const row = document.querySelector<HTMLElement>(`.note-row[data-reorder-note-id="${CSS.escape(noteId)}"]`)
      const handle = row?.querySelector<HTMLButtonElement>('[aria-label^="Orden manual de "] > button') ?? null
      if (!handle) {
        if (attempts < 8) window.requestAnimationFrame(() => dispatchDragStart(noteId, attempts + 1))
        return
      }

      handle.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId,
        pointerType,
        isPrimary: true,
        button: 0,
        buttons: 1,
        clientX: startX,
        clientY: startY,
      }))
    }

    function handlePointerDown(event: PointerEvent) {
      if (reorderModeActive()) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      const target = event.target
      if (!(target instanceof Element)) return

      const openButton = target.closest<HTMLElement>('.note-row__open')
      const row = openButton?.closest<HTMLElement>('.note-row[data-reorder-note-id]') ?? null
      if (!openButton || !row) return

      const toggle = findReorderToggle()
      if (!toggle || toggle.disabled) return

      // On touch/pen this gesture owns the long press. This prevents the bulk-privacy
      // long-press listener from selecting the same note while it is being dragged.
      if (event.pointerType !== 'mouse') event.stopImmediatePropagation()

      resetPress()
      pointerId = event.pointerId
      pointerType = event.pointerType || 'touch'
      startX = event.clientX
      startY = event.clientY
      pressedNoteId = noteIdFromRow(row)
      if (!pressedNoteId) return

      timer = window.setTimeout(() => {
        timer = null
        if (!pressedNoteId) return
        suppressClickForId = pressedNoteId
        gestureDragActive = true
        toggle.click()
        createDragGhost(pressedNoteId)
        if ('vibrate' in navigator) navigator.vibrate?.(18)
        window.requestAnimationFrame(() => dispatchDragStart(pressedNoteId))
      }, NOTE_REORDER_LONG_PRESS_MS)
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerId !== pointerId) return

      if (gestureDragActive) {
        event.preventDefault()
        moveDragGhost(event.clientX, event.clientY)
        return
      }

      if (timer !== null && Math.hypot(event.clientX - startX, event.clientY - startY) > NOTE_REORDER_MOVE_TOLERANCE) {
        resetPress()
      }
    }

    function finishAutomaticMode() {
      document.body.setAttribute('data-oanix-note-drop-finishing', 'true')
      document.body.removeAttribute('data-oanix-note-reorder-mode')
      let attempts = 0
      const finish = () => {
        attempts += 1
        const toggle = findReorderToggle()
        if (toggle && toggle.getAttribute('aria-label') === 'Terminar de ordenar notas' && !toggle.disabled) {
          toggle.click()
          document.body.removeAttribute('data-oanix-note-drop-finishing')
          syncModeAttribute()
          return
        }
        if (attempts < 100) window.setTimeout(finish, 40)
        else {
          document.body.removeAttribute('data-oanix-note-drop-finishing')
          syncModeAttribute()
        }
      }
      window.setTimeout(finish, 0)
    }

    function handlePointerEnd(event: PointerEvent) {
      if (pointerId !== -1 && event.pointerId !== pointerId) return
      clearTimer()
      removeDragGhost()
      if (gestureDragActive) {
        gestureDragActive = false
        finishAutomaticMode()
      }
      resetPress()
    }

    function handleClick(event: MouseEvent) {
      if (!suppressClickForId) return
      const target = event.target
      if (!(target instanceof Element)) return
      const row = target.closest<HTMLElement>('.note-row[data-reorder-note-id]')
      if (!row || noteIdFromRow(row) !== suppressClickForId) return
      event.preventDefault()
      event.stopImmediatePropagation()
      suppressClickForId = ''
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('pointermove', handlePointerMove, true)
    document.addEventListener('pointerup', handlePointerEnd)
    document.addEventListener('pointercancel', handlePointerEnd)
    document.addEventListener('click', handleClick, true)

    return () => {
      resetPress()
      removeDragGhost()
      observer.disconnect()
      document.body.removeAttribute('data-oanix-note-reorder-mode')
      document.body.removeAttribute('data-oanix-note-drop-finishing')
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerup', handlePointerEnd)
      document.removeEventListener('pointercancel', handlePointerEnd)
      document.removeEventListener('click', handleClick, true)
    }
  }, [])

  return null
}
