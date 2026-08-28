import { useEffect } from 'react'
import './v383WorkspaceVisual.css'
import './workspaceStateContract.css'
import './workspaceRefinements.css'

/**
 * Final visual contract marker for the unlocked notes workspace.
 *
 * The runtime only mirrors note-detail state from the real notes shell. It does
 * not observe document.body, covers, or unrelated workspace mutations.
 */
export function V383WorkspaceVisualRuntime() {
  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    const shell = document.querySelector<HTMLElement>('.notes-shell')
    let lastNoteDetailOpen: boolean | null = null

    const syncNoteDetailState = () => {
      const noteDetailOpen = Boolean(
        shell?.classList.contains('notes-shell--open') && shell.querySelector('.note-view'),
      )
      root.classList.toggle('oanix-note-detail-open', noteDetailOpen)
      body.classList.toggle('oanix-note-detail-open', noteDetailOpen)
      if (lastNoteDetailOpen === noteDetailOpen) return
      lastNoteDetailOpen = noteDetailOpen
      window.dispatchEvent(new CustomEvent('oanix:note-detail-state-changed', {
        detail: { open: noteDetailOpen },
      }))
    }

    root.classList.add('oanix-v383-visual')
    body.classList.add('oanix-v383-visual')
    syncNoteDetailState()

    let shellObserver: MutationObserver | null = null
    if (shell) {
      const observedShell = shell
      shellObserver = new MutationObserver(syncNoteDetailState)
      shellObserver.observe(observedShell, {
        attributes: true,
        attributeFilter: ['class'],
      })
    }

    return () => {
      shellObserver?.disconnect()
      root.classList.remove('oanix-v383-visual', 'oanix-note-detail-open')
      body.classList.remove('oanix-v383-visual', 'oanix-note-detail-open')
    }
  }, [])

  return null
}
