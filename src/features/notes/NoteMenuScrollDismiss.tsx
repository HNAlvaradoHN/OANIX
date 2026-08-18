import { useEffect } from 'react'

function closeOpenNoteRowMenu() {
  const openButton = document.querySelector<HTMLButtonElement>(
    '.note-row__menu-button[aria-expanded="true"]',
  )
  openButton?.click()
}

export function NoteMenuScrollDismiss() {
  useEffect(() => {
    function handleScroll(event: Event) {
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.closest('.notes-list')) return
      closeOpenNoteRowMenu()
    }

    function handleTouchMove(event: TouchEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.closest('.notes-list')) return
      closeOpenNoteRowMenu()
    }

    document.addEventListener('scroll', handleScroll, true)
    document.addEventListener('touchmove', handleTouchMove, { capture: true, passive: true })

    return () => {
      document.removeEventListener('scroll', handleScroll, true)
      document.removeEventListener('touchmove', handleTouchMove, true)
    }
  }, [])

  return null
}
