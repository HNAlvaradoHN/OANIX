import { useEffect } from 'react'
import './v383WorkspaceVisual.css'

/**
 * Final visual contract for the unlocked notes workspace.
 *
 * The business logic and existing encrypted-data runtimes stay untouched. This
 * runtime only marks the document so one scoped stylesheet can own the visual
 * presentation copied from the approved v38.3 reference.
 */
export function V383WorkspaceVisualRuntime() {
  useEffect(() => {
    const root = document.documentElement
    const body = document.body

    root.classList.add('oanix-v383-visual')
    body.classList.add('oanix-v383-visual')

    return () => {
      root.classList.remove('oanix-v383-visual')
      body.classList.remove('oanix-v383-visual')
    }
  }, [])

  return null
}
