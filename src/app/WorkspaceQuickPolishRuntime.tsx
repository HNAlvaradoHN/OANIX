import { useEffect } from 'react'
import './workspaceQuickPolish.css'

type NoteVisualChangedDetail = {
  note?: { id?: unknown }
}

function closeExpandedNoteMenu(noteId: string) {
  const row = Array.from(document.querySelectorAll<HTMLElement>('.note-row[data-reorder-note-id]'))
    .find((candidate) => candidate.dataset.reorderNoteId === noteId)
  const opener = row?.querySelector<HTMLButtonElement>('.note-row__menu-button[aria-expanded="true"]')
  opener?.click()
}

function enterFolderAppearanceOnlyMode(toggle: HTMLElement) {
  window.requestAnimationFrame(() => {
    const modal = toggle.closest<HTMLElement>('.oanix-folder-customizer')
    const actions = toggle.closest<HTMLElement>('.oanix-folder-customizer__actions')
    const appearance = modal?.querySelector<HTMLElement>('.oanix-folder-appearance-picker')
    if (!modal || !actions || !appearance || appearance.hidden) return

    actions.hidden = true
    modal.dataset.oanixAppearanceOnly = 'true'

    const observer = new MutationObserver(() => {
      if (!appearance.hidden) return
      observer.disconnect()
      actions.hidden = false
      delete modal.dataset.oanixAppearanceOnly
      const cancel = actions.querySelector<HTMLButtonElement>('.oanix-folder-customizer__cancel-action')
      window.requestAnimationFrame(() => cancel?.click())
    })

    observer.observe(appearance, { attributes: true, attributeFilter: ['hidden'] })
  })
}

export function WorkspaceQuickPolishRuntime() {
  useEffect(() => {
    const handleNoteVisualChanged = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const detail = event.detail as NoteVisualChangedDetail | null
      const noteId = detail?.note?.id
      if (typeof noteId !== 'string' || !noteId) return
      window.requestAnimationFrame(() => closeExpandedNoteMenu(noteId))
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const appearanceToggle = target.closest<HTMLElement>('.oanix-folder-customizer__appearance-toggle')
      if (appearanceToggle) enterFolderAppearanceOnlyMode(appearanceToggle)
    }

    window.addEventListener('oanix:note-visual-changed', handleNoteVisualChanged)
    document.addEventListener('click', handleClick)

    return () => {
      window.removeEventListener('oanix:note-visual-changed', handleNoteVisualChanged)
      document.removeEventListener('click', handleClick)
    }
  }, [])

  return null
}
