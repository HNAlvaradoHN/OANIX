import { useEffect } from 'react'
import '../../styles/note-menu-viewport-fit.css'

const EDGE_GAP = 10
const MIN_SCROLL_HEIGHT = 72

function viewportBounds() {
  const viewport = window.visualViewport
  const top = viewport?.offsetTop ?? 0
  const height = viewport?.height ?? window.innerHeight
  return { top, bottom: top + height }
}

function fitOpenNoteMenus() {
  const viewport = viewportBounds()

  for (const menu of document.querySelectorAll<HTMLElement>('.note-row__menu')) {
    const wrap = menu.closest<HTMLElement>('.note-row__menu-wrap')
    const button = wrap?.querySelector<HTMLElement>('.note-row__menu-button')
    const list = menu.closest<HTMLElement>('.notes-list')
    if (!wrap || !button) continue

    // scrollHeight preserves the menu's natural content height even after max-height is applied.
    const naturalHeight = Math.ceil(menu.scrollHeight)
    const buttonRect = button.getBoundingClientRect()
    const listRect = list?.getBoundingClientRect()
    const topBoundary = Math.max(viewport.top, listRect?.top ?? viewport.top) + EDGE_GAP
    const bottomBoundary = Math.min(viewport.bottom, listRect?.bottom ?? viewport.bottom) - EDGE_GAP
    const spaceBelow = Math.max(0, bottomBoundary - buttonRect.bottom)
    const spaceAbove = Math.max(0, buttonRect.top - topBoundary)

    let placement: 'down' | 'up'
    if (naturalHeight <= spaceBelow) placement = 'down'
    else if (naturalHeight <= spaceAbove) placement = 'up'
    else placement = spaceAbove > spaceBelow ? 'up' : 'down'

    const available = placement === 'up' ? spaceAbove : spaceBelow
    const maxHeight = Math.max(MIN_SCROLL_HEIGHT, Math.floor(available))

    menu.dataset.oanixMenuPlacement = placement
    menu.style.setProperty('--oanix-note-menu-max-height', `${maxHeight}px`)
  }
}

export function NoteMenuViewportFit() {
  useEffect(() => {
    let frame = 0

    const scheduleFit = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        fitOpenNoteMenus()
      })
    }

    // Note menus only need a fresh measurement after user interaction can open or
    // close them, or when the viewport changes. Watching every DOM mutation made
    // the whole application pay for an operation that belongs to this one control.
    document.addEventListener('click', scheduleFit)
    window.addEventListener('resize', scheduleFit)
    window.visualViewport?.addEventListener('resize', scheduleFit)
    window.visualViewport?.addEventListener('scroll', scheduleFit)
    scheduleFit()

    return () => {
      document.removeEventListener('click', scheduleFit)
      window.removeEventListener('resize', scheduleFit)
      window.visualViewport?.removeEventListener('resize', scheduleFit)
      window.visualViewport?.removeEventListener('scroll', scheduleFit)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return null
}
