import { useEffect } from 'react'
import Sortable from 'sortablejs'

const NOTE_LIST_SELECTOR = '.notes-list'
const FOLDER_ADD_TRIGGER_SELECTOR = '.oanix-organic-folder-control--add, .oanix-folder-rail__item--add'
const FOLDER_MANAGER_BUTTON_SELECTOR = '.notes-tab--add'

export function WorkspaceInputCompatibilityRuntime() {
  useEffect(() => {
    const syncNoteSortableWithPointer = (event: PointerEvent) => {
      const list = document.querySelector<HTMLElement>(NOTE_LIST_SELECTOR)
      if (!list) return
      const sortable = Sortable.get(list)
      if (!sortable) return

      if (event.pointerType === 'mouse') {
        sortable.option('disabled', false)
        return
      }

      if (event.pointerType === 'touch') {
        sortable.option('disabled', true)
      }
    }

    const openFolderManagerFromVisibleControl = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const trigger = event.target.closest<HTMLElement>(FOLDER_ADD_TRIGGER_SELECTOR)
      if (!trigger) return

      const managerButton = document.querySelector<HTMLButtonElement>(FOLDER_MANAGER_BUTTON_SELECTOR)
      if (!managerButton || managerButton === trigger || managerButton.disabled) return

      event.preventDefault()
      event.stopImmediatePropagation()
      managerButton.click()
    }

    document.addEventListener('pointerdown', syncNoteSortableWithPointer, true)
    document.addEventListener('click', openFolderManagerFromVisibleControl, true)

    return () => {
      document.removeEventListener('pointerdown', syncNoteSortableWithPointer, true)
      document.removeEventListener('click', openFolderManagerFromVisibleControl, true)
    }
  }, [])

  return null
}
