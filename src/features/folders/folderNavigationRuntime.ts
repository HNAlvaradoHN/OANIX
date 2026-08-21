import { useEffect } from 'react'
import './folderMotion.css'

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

function updateCardPointer(card: HTMLButtonElement, clientX: number, clientY: number) {
  const rect = card.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return

  const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
  const rotateY = (x - 0.5) * 7
  const rotateX = (0.5 - y) * 7

  card.style.setProperty('--oanix-folder-pointer-x', `${Math.round(x * 100)}%`)
  card.style.setProperty('--oanix-folder-pointer-y', `${Math.round(y * 100)}%`)
  card.style.setProperty('--oanix-folder-rotate-x', `${rotateX.toFixed(2)}deg`)
  card.style.setProperty('--oanix-folder-rotate-y', `${rotateY.toFixed(2)}deg`)
}

function resetCard(card: HTMLButtonElement) {
  delete card.dataset.oanixFolderEngaged
  card.style.setProperty('--oanix-folder-pointer-x', '50%')
  card.style.setProperty('--oanix-folder-pointer-y', '45%')
  card.style.setProperty('--oanix-folder-rotate-x', '0deg')
  card.style.setProperty('--oanix-folder-rotate-y', '0deg')
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

    function handlePointerDown(event: PointerEvent) {
      const card = folderCardFromTarget(event.target)
      if (!card) return
      card.dataset.oanixFolderEngaged = 'true'
      updateCardPointer(card, event.clientX, event.clientY)
    }

    function handlePointerMove(event: PointerEvent) {
      const card = folderCardFromTarget(event.target)
      if (!card) return
      if (event.pointerType === 'touch' && card.dataset.oanixFolderEngaged !== 'true') return
      updateCardPointer(card, event.clientX, event.clientY)
    }

    function handlePointerEnd(event: PointerEvent) {
      const card = folderCardFromTarget(event.target)
      if (!card) return
      resetCard(card)
    }

    document.addEventListener('click', handleClickCapture, true)
    window.addEventListener('popstate', handlePopState)
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('pointermove', handlePointerMove, true)
    document.addEventListener('pointerup', handlePointerEnd, true)
    document.addEventListener('pointercancel', handlePointerEnd, true)
    document.addEventListener('pointerout', handlePointerEnd, true)

    return () => {
      document.removeEventListener('click', handleClickCapture, true)
      window.removeEventListener('popstate', handlePopState)
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerup', handlePointerEnd, true)
      document.removeEventListener('pointercancel', handlePointerEnd, true)
      document.removeEventListener('pointerout', handlePointerEnd, true)
    }
  }, [])
}
