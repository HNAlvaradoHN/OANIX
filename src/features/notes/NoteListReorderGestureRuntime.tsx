import { useEffect } from 'react'
import './noteReorderGesture.css'

const NOTE_REORDER_LONG_PRESS_MS = 520
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

function ensureModeChrome() {
  const active = reorderModeActive()
  document.body.toggleAttribute('data-oanix-note-reorder-mode', active)

  document.querySelectorAll('.oanix-note-reorder-menu-proxy, .oanix-note-reorder-done').forEach((node) => node.remove())
  if (!active) return

  const sidebar = document.querySelector<HTMLElement>('.notes-sidebar')
  if (sidebar) {
    const done = document.createElement('button')
    done.type = 'button'
    done.className = 'oanix-note-reorder-done'
    done.textContent = 'Listo'
    done.setAttribute('aria-label', 'Terminar de ordenar notas')
    done.addEventListener('click', () => findReorderToggle()?.click(), { once: true })
    sidebar.append(done)
  }

  document.querySelectorAll<HTMLElement>('.note-row[data-reorder-note-id]').forEach((row) => {
    const noteId = noteIdFromRow(row)
    if (!noteId) return

    const menu = document.createElement('button')
    menu.type = 'button'
    menu.className = 'oanix-note-reorder-menu-proxy'
    menu.textContent = '⋮'
    menu.setAttribute('aria-label', 'Acciones de la nota')
    menu.title = 'Acciones de la nota'
    menu.addEventListener('pointerdown', (event) => event.stopPropagation())
    menu.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      findReorderToggle()?.click()
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`.note-row[data-reorder-note-id="${CSS.escape(noteId)}"] .note-row__menu-button`)
          ?.click()
      })
    })
    row.append(menu)
  })
}

export function NoteListReorderGestureRuntime() {
  useEffect(() => {
    let timer: number | null = null
    let pressedRow: HTMLElement | null = null
    let pointerId = -1
    let startX = 0
    let startY = 0
    let suppressClickForId = ''

    const clearPress = () => {
      if (timer !== null) window.clearTimeout(timer)
      timer = null
      pressedRow = null
      pointerId = -1
    }

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(ensureModeChrome)
    })
    observer.observe(document.body, { childList: true, subtree: true })
    ensureModeChrome()

    function handlePointerDown(event: PointerEvent) {
      if (reorderModeActive()) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      const target = event.target
      if (!(target instanceof Element)) return

      const avatar = target.closest<HTMLElement>('.note-row__avatar')
      const openButton = avatar?.closest<HTMLElement>('.note-row__open')
      const row = openButton?.closest<HTMLElement>('.note-row[data-reorder-note-id]') ?? null
      if (!avatar || !row || !openButton) return

      clearPress()
      pressedRow = row
      pointerId = event.pointerId
      startX = event.clientX
      startY = event.clientY
      const noteId = noteIdFromRow(row)
      timer = window.setTimeout(() => {
        timer = null
        if (!pressedRow || !noteId) return
        suppressClickForId = noteId
        findReorderToggle()?.click()
        if ('vibrate' in navigator) navigator.vibrate?.(16)
        window.requestAnimationFrame(ensureModeChrome)
      }, NOTE_REORDER_LONG_PRESS_MS)
    }

    function handlePointerMove(event: PointerEvent) {
      if (timer === null || event.pointerId !== pointerId) return
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > NOTE_REORDER_MOVE_TOLERANCE) clearPress()
    }

    function handlePointerEnd(event: PointerEvent) {
      if (pointerId !== -1 && event.pointerId !== pointerId) return
      clearPress()
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
    document.addEventListener('pointerup', handlePointerEnd, true)
    document.addEventListener('pointercancel', handlePointerEnd, true)
    document.addEventListener('click', handleClick, true)

    return () => {
      clearPress()
      observer.disconnect()
      document.body.removeAttribute('data-oanix-note-reorder-mode')
      document.querySelectorAll('.oanix-note-reorder-menu-proxy, .oanix-note-reorder-done').forEach((node) => node.remove())
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerup', handlePointerEnd, true)
      document.removeEventListener('pointercancel', handlePointerEnd, true)
      document.removeEventListener('click', handleClick, true)
    }
  }, [])

  return null
}
