import { useEffect } from 'react'

/**
 * Final visual contract marker for the unlocked notes workspace.
 *
 * Business logic and encrypted-data runtimes stay untouched. The stylesheet is
 * imported explicitly at the end of main.tsx so its cascade position is
 * deterministic and cannot be silently overtaken by an older polish layer.
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
