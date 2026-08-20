import { useLayoutEffect } from 'react'

export function NotebookSimpleImageRuntime() {
  useLayoutEffect(() => {
    if (import.meta.env.MODE === 'capacitor') return
  }, [])
  return null
}
