import { useEffect } from 'react'

function syncCoveredBackground() {
  const background = document.querySelector<HTMLElement>('.oanix-organic-background')
  if (!background) return

  if (!background.classList.contains('oanix-organic-background--covered')) {
    background.style.removeProperty('--oanix-organic-cover-image')
    return
  }

  const inlineImage = background.style.backgroundImage.trim()
  if (!inlineImage || inlineImage === 'none') return

  if (background.style.getPropertyValue('--oanix-organic-cover-image') !== inlineImage) {
    background.style.setProperty('--oanix-organic-cover-image', inlineImage)
  }
  background.style.removeProperty('background-image')
}

/**
 * Final visual contract marker for the unlocked notes workspace.
 *
 * Business logic and encrypted-data runtimes stay untouched. This runtime only
 * exposes visual state that portals outside .notes-shell cannot infer by normal
 * descendant selectors, and normalizes the active folder cover for the final
 * presentation layer.
 */
export function V383WorkspaceVisualRuntime() {
  useEffect(() => {
    const root = document.documentElement
    const body = document.body

    const syncVisualState = () => {
      const noteDetailOpen = document.querySelector('.notes-shell.notes-shell--open .note-view') !== null
      root.classList.toggle('oanix-note-detail-open', noteDetailOpen)
      body.classList.toggle('oanix-note-detail-open', noteDetailOpen)
      syncCoveredBackground()
    }

    root.classList.add('oanix-v383-visual')
    body.classList.add('oanix-v383-visual')
    syncVisualState()

    const observer = new MutationObserver(syncVisualState)
    observer.observe(body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    })

    return () => {
      observer.disconnect()
      root.classList.remove('oanix-v383-visual', 'oanix-note-detail-open')
      body.classList.remove('oanix-v383-visual', 'oanix-note-detail-open')
    }
  }, [])

  return null
}
