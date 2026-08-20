import { useLayoutEffect } from 'react'

function normalizeNotebookImage(image: HTMLElement) {
  image.dataset.imageCompact = 'false'
  image.dataset.imageAlignment = 'center'
  image.dataset.oanixNotebookFullWidth = 'true'
}

function pinMobileEditorTools() {
  if (!window.matchMedia('(max-width: 760px)').matches) return

  const viewport = window.visualViewport
  const visibleTop = viewport?.offsetTop ?? 0
  const visibleHeight = viewport?.height ?? window.innerHeight
  const gap = 10

  document.querySelectorAll<HTMLElement>('.image-note-editor-root').forEach((root) => {
    const dock = root.querySelector<HTMLElement>('.mobile-editor-dock')
    if (!dock) return

    const dockHeight = Math.max(48, dock.getBoundingClientRect().height || dock.offsetHeight)
    const dockTop = Math.max(visibleTop + gap, visibleTop + visibleHeight - dockHeight - gap)
    dock.style.setProperty('top', `${Math.round(dockTop)}px`, 'important')
    dock.style.setProperty('bottom', 'auto', 'important')

    const panel = root.querySelector<HTMLElement>('.editor-command-panel')
    if (!panel) return

    const availableHeight = Math.max(150, dockTop - visibleTop - gap * 2)
    const panelHeight = Math.min(panel.scrollHeight || availableHeight, availableHeight)
    const panelTop = Math.max(visibleTop + gap, dockTop - panelHeight - gap)
    panel.style.setProperty('top', `${Math.round(panelTop)}px`, 'important')
    panel.style.setProperty('bottom', 'auto', 'important')
    panel.style.setProperty('max-height', `${Math.round(availableHeight)}px`, 'important')
  })
}

export function NotebookSimpleImageRuntime() {
  useLayoutEffect(() => {
    if (import.meta.env.MODE === 'capacitor') return

    const syncImages = () => {
      document
        .querySelectorAll<HTMLElement>(".editor-surface [data-image-block='true']")
        .forEach(normalizeNotebookImage)
      pinMobileEditorTools()
    }

    // Only react to DOM insertion/removal. Watching the image attributes themselves caused a
    // mutation feedback loop because normalization rewrote those same attributes on every pass.
    const observer = new MutationObserver(syncImages)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    const syncViewport = () => pinMobileEditorTools()

    syncImages()
    window.visualViewport?.addEventListener('resize', syncViewport)
    window.visualViewport?.addEventListener('scroll', syncViewport)
    window.addEventListener('resize', syncViewport)
    window.addEventListener('scroll', syncViewport, { passive: true })

    return () => {
      observer.disconnect()
      window.visualViewport?.removeEventListener('resize', syncViewport)
      window.visualViewport?.removeEventListener('scroll', syncViewport)
      window.removeEventListener('resize', syncViewport)
      window.removeEventListener('scroll', syncViewport)
    }
  }, [])

  return null
}
