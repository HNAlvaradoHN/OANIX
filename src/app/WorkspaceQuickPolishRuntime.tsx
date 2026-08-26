import { useEffect } from 'react'
import './workspaceQuickPolish.css'

type NoteVisualChangedDetail = {
  note?: { id?: unknown }
}

function removeRedundantFolderOpenAction() {
  document
    .querySelectorAll<HTMLElement>('.oanix-folder-customizer__open-action')
    .forEach((button) => button.remove())
}

function closeExpandedNoteMenu(noteId: string) {
  const row = Array.from(document.querySelectorAll<HTMLElement>('.note-row[data-reorder-note-id]'))
    .find((candidate) => candidate.dataset.reorderNoteId === noteId)
  const opener = row?.querySelector<HTMLButtonElement>('.note-row__menu-button[aria-expanded="true"]')
  opener?.click()
}

export function WorkspaceQuickPolishRuntime() {
  useEffect(() => {
    removeRedundantFolderOpenAction()

    const observer = new MutationObserver(removeRedundantFolderOpenAction)
    observer.observe(document.body, { childList: true, subtree: true })

    const handleNoteVisualChanged = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const detail = event.detail as NoteVisualChangedDetail | null
      const noteId = detail?.note?.id
      if (typeof noteId !== 'string' || !noteId) return
      window.requestAnimationFrame(() => closeExpandedNoteMenu(noteId))
    }

    window.addEventListener('oanix:note-visual-changed', handleNoteVisualChanged)

    return () => {
      observer.disconnect()
      window.removeEventListener('oanix:note-visual-changed', handleNoteVisualChanged)
    }
  }, [])

  return null
}
