import { useEffect } from 'react'
const FOLDER_ADD_TRIGGER_SELECTOR = '.oanix-organic-folder-control--add, .oanix-folder-rail__item--add, .notes-tab--add'

export function WorkspaceInputCompatibilityRuntime() {
  useEffect(() => {
    const openFolderCreatorFromVisibleControl = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const trigger = event.target.closest<HTMLElement>(FOLDER_ADD_TRIGGER_SELECTOR)
      if (!trigger) return

      event.preventDefault()
      event.stopImmediatePropagation()
      window.dispatchEvent(new CustomEvent('oanix:open-folder-creator'))
    }

    document.addEventListener('click', openFolderCreatorFromVisibleControl, true)

    return () => {
      document.removeEventListener('click', openFolderCreatorFromVisibleControl, true)
    }
  }, [])

  return null
}
