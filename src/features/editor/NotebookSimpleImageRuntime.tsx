import { useLayoutEffect } from 'react'

function normalizeNotebookImage(image: HTMLElement) {
  image.dataset.imageCompact = 'false'
  image.dataset.imageAlignment = 'center'
  image.dataset.oanixNotebookFullWidth = 'true'
}

function keyboardInsetPx(): number {
  const viewport = window.visualViewport
  if (!viewport) return 0
  return Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
}

function syncKeyboardInset() {
  document.documentElement.style.setProperty('--oanix-keyboard-inset', `${keyboardInsetPx()}px`)
}

export function NotebookSimpleImageRuntime() {
  useLayoutEffect(() => {
    if (import.meta.env.MODE === 'capacitor') return

    const syncImages = () => {
      document
        .querySelectorAll<HTMLElement>(".editor-surface [data-image-block='true']")
        .forEach(normalizeNotebookImage)
    }

    const observer = new MutationObserver(syncImages)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-image-alignment', 'data-image-compact'],
    })

    syncImages()
    syncKeyboardInset()
    window.visualViewport?.addEventListener('resize', syncKeyboardInset)
    window.visualViewport?.addEventListener('scroll', syncKeyboardInset)
    window.addEventListener('resize', syncKeyboardInset)

    return () => {
      observer.disconnect()
      window.visualViewport?.removeEventListener('resize', syncKeyboardInset)
      window.visualViewport?.removeEventListener('scroll', syncKeyboardInset)
      window.removeEventListener('resize', syncKeyboardInset)
      document.documentElement.style.removeProperty('--oanix-keyboard-inset')
    }
  }, [])

  return null
}
