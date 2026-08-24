import { useEffect } from 'react'

function syncCoveredBackground(background: HTMLElement | null) {
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
 * The runtime only watches the two DOM nodes whose own state it mirrors. It does
 * not observe document.body or unrelated workspace mutations.
 */
export function V383WorkspaceVisualRuntime() {
  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    const shell = document.querySelector<HTMLElement>('.notes-shell')

    const syncNoteDetailState = () => {
      const noteDetailOpen = Boolean(
        shell?.classList.contains('notes-shell--open') && shell.querySelector('.note-view'),
      )
      root.classList.toggle('oanix-note-detail-open', noteDetailOpen)
      body.classList.toggle('oanix-note-detail-open', noteDetailOpen)
    }

    root.classList.add('oanix-v383-visual')
    body.classList.add('oanix-v383-visual')
    syncNoteDetailState()

    const shellObserver = shell ? new MutationObserver(syncNoteDetailState) : null
    shellObserver?.observe(shell, {
      attributes: true,
      attributeFilter: ['class'],
    })

    let backgroundObserver: MutationObserver | null = null
    let backgroundFrame = 0
    let backgroundAttempts = 0

    const bindBackgroundObserver = () => {
      backgroundFrame = 0
      const background = document.querySelector<HTMLElement>('.oanix-organic-background')
      if (!background) {
        backgroundAttempts += 1
        if (backgroundAttempts < 30) {
          backgroundFrame = window.requestAnimationFrame(bindBackgroundObserver)
        }
        return
      }

      syncCoveredBackground(background)
      backgroundObserver = new MutationObserver(() => syncCoveredBackground(background))
      backgroundObserver.observe(background, {
        attributes: true,
        attributeFilter: ['class', 'style'],
      })
    }

    bindBackgroundObserver()

    return () => {
      shellObserver?.disconnect()
      backgroundObserver?.disconnect()
      if (backgroundFrame) window.cancelAnimationFrame(backgroundFrame)
      root.classList.remove('oanix-v383-visual', 'oanix-note-detail-open')
      body.classList.remove('oanix-v383-visual', 'oanix-note-detail-open')
    }
  }, [])

  return null
}
