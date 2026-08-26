import { useEffect } from 'react'
import Sortable from 'sortablejs'
import { persistFolderOrder } from '../folders/folderService'

const NOTE_LIST_SELECTOR = '.notes-list'
const FOLDER_ADD_TRIGGER_SELECTOR = '.oanix-organic-folder-control--add, .oanix-folder-rail__item--add, .notes-tab--add'
const FOLDER_ITEM_SELECTOR = '.oanix-folder-rail__item[data-oanix-folder-id]'
const FOLDER_SCROLL_SELECTOR = '.oanix-folder-rail__scroll'

type SortableStaticWithGet = typeof Sortable & {
  get(element: HTMLElement): ReturnType<typeof Sortable.create> | undefined
}

const sortableApi = Sortable as SortableStaticWithGet

function visibleFolderOrder(): string[] {
  const rail = document.querySelector<HTMLElement>(FOLDER_SCROLL_SELECTOR)
  if (!rail) return []
  return Array.from(rail.querySelectorAll<HTMLElement>(`:scope > ${FOLDER_ITEM_SELECTOR}`))
    .flatMap((item) => item.dataset.oanixFolderId ? [item.dataset.oanixFolderId] : [])
}

export function WorkspaceInputCompatibilityRuntime() {
  useEffect(() => {
    let desktopFolderPointerId: number | null = null

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

    const rememberDesktopFolderPointer = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return
      const target = event.target
      if (!(target instanceof Element) || !target.closest(FOLDER_ITEM_SELECTOR)) return
      desktopFolderPointerId = event.pointerId
    }

    const persistDesktopFolderDrop = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || desktopFolderPointerId !== event.pointerId) return
      desktopFolderPointerId = null
      if (!document.querySelector('.oanix-folder-grid--reordering')) return

      const order = visibleFolderOrder()
      if (order.length < 2) return
      void persistFolderOrder(order).catch(() => {
        window.dispatchEvent(new Event('oanix:local-data-changed'))
      })
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
    document.addEventListener('pointerdown', rememberDesktopFolderPointer, true)
    document.addEventListener('pointerup', persistDesktopFolderDrop, true)
    document.addEventListener('pointercancel', persistDesktopFolderDrop, true)
    document.addEventListener('click', openFolderCreatorFromVisibleControl, true)

    return () => {
      desktopFolderPointerId = null
      document.removeEventListener('pointerdown', syncNoteSortableWithPointer, true)
      document.removeEventListener('pointerdown', rememberDesktopFolderPointer, true)
      document.removeEventListener('pointerup', persistDesktopFolderDrop, true)
      document.removeEventListener('pointercancel', persistDesktopFolderDrop, true)
      document.removeEventListener('click', openFolderCreatorFromVisibleControl, true)
    }
  }, [])

  return null
}
