import { useLayoutEffect } from 'react'

function normalizeNotebookImage(image: HTMLElement) {
  image.dataset.imageCompact = 'false'
  image.dataset.imageAlignment = 'center'
  image.dataset.oanixNotebookFullWidth = 'true'
}

export function NotebookSimpleImageRuntime() {
  useLayoutEffect(() => {
    if (import.meta.env.MODE === 'capacitor') return

    const syncImages = () => {
      document
        .querySelectorAll<HTMLElement>(".editor-surface [data-image-block='true']")
        .forEach(normalizeNotebookImage)
    }

    // Only react to DOM insertion/removal. Watching the image attributes themselves caused a
    // mutation feedback loop because normalization rewrote those same attributes on every pass.
    const observer = new MutationObserver(syncImages)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    syncImages()

    return () => {
      observer.disconnect()
    }
  }, [])

  return null
}
