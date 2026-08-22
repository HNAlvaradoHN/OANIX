import { useEffect } from 'react'

type FolderHistoryView = 'home' | 'list'

interface FolderHistoryState {
  oanixFolderView?: FolderHistoryView
}

function currentHistoryState(): Record<string, unknown> {
  const value = window.history.state
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function folderHistoryView(state: unknown): FolderHistoryView | null {
  if (!state || typeof state !== 'object') return null
  const value = (state as FolderHistoryState).oanixFolderView
  return value === 'home' || value === 'list' ? value : null
}

function folderCardFromTarget(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) return null
  const card = target.closest<HTMLButtonElement>('.oanix-folder-card')
  if (!card || !card.closest('.oanix-folder-grid')) return null
  return card
}

export function useFolderNavigationRuntime() {
  useEffect(() => {
    let replayingHistory = false

    const initialState = currentHistoryState()
    if (folderHistoryView(initialState) === null) {
      window.history.replaceState({ ...initialState, oanixFolderView: 'home' }, '')
    }

    function handleClickCapture(event: MouseEvent) {
      if (replayingHistory) return
      const target = event.target
      if (!(target instanceof Element)) return

      const homeBack = target.closest<HTMLButtonElement>('[data-oanix-folder-home-back="true"]')
      if (homeBack) {
        const view = folderHistoryView(window.history.state)
        if (view === 'list') {
          event.preventDefault()
          event.stopPropagation()
          window.history.back()
        } else {
          window.history.replaceState({ ...currentHistoryState(), oanixFolderView: 'home' }, '')
        }
        return
      }

      const card = folderCardFromTarget(target)
      if (!card || card.classList.contains('oanix-folder-card--add')) return

      const view = folderHistoryView(window.history.state)
      if (view === 'list') return
      if (view !== 'home') {
        window.history.replaceState({ ...currentHistoryState(), oanixFolderView: 'home' }, '')
      }
      window.history.pushState({ ...currentHistoryState(), oanixFolderView: 'list' }, '')
    }

    function handlePopState(event: PopStateEvent) {
      const view = folderHistoryView(event.state)
      if (view !== 'home') return

      const homeBack = document.querySelector<HTMLButtonElement>('[data-oanix-folder-home-back="true"]')
      if (!homeBack) return

      replayingHistory = true
      homeBack.click()
      replayingHistory = false
    }

    document.addEventListener('click', handleClickCapture, true)
    window.addEventListener('popstate', handlePopState)

    return () => {
      document.removeEventListener('click', handleClickCapture, true)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])
}
