import { useEffect } from 'react'
import Sortable from 'sortablejs'

const NOTE_LIST_SELECTOR = '.notes-list'
const FOLDER_ADD_TRIGGER_SELECTOR = '.oanix-organic-folder-control--add, .oanix-folder-rail__item--add, .notes-tab--add'

type SortableStaticWithGet = typeof Sortable & {
  get(element: HTMLElement): ReturnType<typeof Sortable.create> | undefined
}

const sortableApi = Sortable as SortableStaticWithGet

export function WorkspaceInputCompatibilityRuntime() {
  useEffect(() => {
    const syncNoteSortableWithPointer = (event: PointerEvent) => {
      const list = document.querySelector<HTMLElement>(NOTE_LIST_SELECTOR)
      if (!list || typeof sortableApi.get !== 'function') return
      const sortable = sortableApi.get(list)
      if (!sortable) return

      if (event.pointerType === 'mouse') {
        sortable.option('disabled', false)
        return
      }

      if (event.pointerType === 'touch') {
        sortable.option('disabled', true)
      }
    }

    const openFolderCreatorFromVisibleControl = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const trigger = event.target.closest<HTMLElement>(FOLDER_ADD_TRIGGER_SELECTOR)
      if (!trigger) return

      event.preventDefault()
      event.stopImmediatePropagation()
      window.dispatchEvent(new CustomEvent('oanix:open-folder-creator'))
    }

    document.addEventListener('pointerdown', syncNoteSortableWithPointer, true)
    document.addEventListener('click', openFolderCreatorFromVisibleControl, true)

    return () => {
      document.removeEventListener('pointerdown', syncNoteSortableWithPointer, true)
      document.removeEventListener('click', openFolderCreatorFromVisibleControl, true)
    }
  }, [])

  return null
}
