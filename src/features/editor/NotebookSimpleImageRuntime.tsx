import { useLayoutEffect } from 'react'

function normalizeNotebookImage(image: HTMLElement) {
  image.contentEditable = 'false'
  image.dataset.imageCompact = 'false'
  image.dataset.imageAlignment = 'center'
  image.dataset.oanixNotebookFullWidth = 'true'
  image.dataset.imageSelected = 'false'
  image.style.removeProperty('translate')

  // Full-width notebook images have no movable/resizable state. Remove only the controls that
  // can no longer affect this layout; open, name visibility, description and remove stay intact.
  image
    .querySelectorAll<HTMLElement>(
      '[data-image-lock="true"], [data-image-align], [data-image-resize], .editor-image-block__alignment',
    )
    .forEach((control) => control.remove())
}

function notebookImageFromTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const image = target.closest<HTMLElement>('[data-image-block="true"][data-oanix-notebook-full-width="true"]')
  return image?.closest('.editor-surface') ? image : null
}

function selectionParagraph(editor: HTMLElement, selection: Selection): HTMLParagraphElement | null {
  const node = selection.anchorNode
  const element = node instanceof Element ? node : node?.parentElement ?? null
  const paragraph = element?.closest<HTMLParagraphElement>('p') ?? null
  return paragraph?.parentElement === editor ? paragraph : null
}

function rangeHasTextBefore(paragraph: HTMLParagraphElement, range: Range): boolean {
  try {
    const before = document.createRange()
    before.selectNodeContents(paragraph)
    before.setEnd(range.startContainer, range.startOffset)
    return before.toString().length > 0
  } catch {
    return true
  }
}

function rangeHasTextAfter(paragraph: HTMLParagraphElement, range: Range): boolean {
  try {
    const after = document.createRange()
    after.selectNodeContents(paragraph)
    after.setStart(range.endContainer, range.endOffset)
    return after.toString().length > 0
  } catch {
    return true
  }
}

function selectionTouchesImage(editor: HTMLElement, range: Range): boolean {
  return Array.from(editor.children).some((child) => {
    if (!(child instanceof HTMLElement) || child.dataset.imageBlock !== 'true') return false
    try {
      return range.intersectsNode(child)
    } catch {
      return false
    }
  })
}

function protectAtomicImageFromTextDeletion(event: KeyboardEvent) {
  if (event.key !== 'Backspace' && event.key !== 'Delete') return
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest('[data-image-block="true"]')) return

  const editor = target.closest<HTMLElement>('.editor-surface')
  const selection = window.getSelection()
  if (!editor || !selection || selection.rangeCount === 0) return

  const range = selection.getRangeAt(0)
  if (!selection.isCollapsed) {
    if (!selectionTouchesImage(editor, range)) return
    event.preventDefault()
    event.stopImmediatePropagation()
    return
  }

  const paragraph = selectionParagraph(editor, selection)
  if (!paragraph) return

  if (
    event.key === 'Backspace' &&
    !rangeHasTextBefore(paragraph, range) &&
    paragraph.previousElementSibling instanceof HTMLElement &&
    paragraph.previousElementSibling.dataset.imageBlock === 'true'
  ) {
    event.preventDefault()
    event.stopImmediatePropagation()
    return
  }

  if (
    event.key === 'Delete' &&
    !rangeHasTextAfter(paragraph, range) &&
    paragraph.nextElementSibling instanceof HTMLElement &&
    paragraph.nextElementSibling.dataset.imageBlock === 'true'
  ) {
    event.preventDefault()
    event.stopImmediatePropagation()
  }
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

    function stopImageDrag(event: PointerEvent) {
      const image = notebookImageFromTarget(event.target)
      if (!image || !(event.target instanceof Element)) return
      if (!event.target.closest('[data-image-preview="true"]')) return
      // Keep the normal button click, but do not let ImageNoteEditor start its legacy drag gesture.
      event.stopPropagation()
    }

    function openImageFromPreview(event: MouseEvent) {
      const image = notebookImageFromTarget(event.target)
      if (!image || !(event.target instanceof Element)) return
      if (!event.target.closest('[data-image-preview="true"]')) return

      const open = image.querySelector<HTMLButtonElement>('[data-image-open-action="true"]')
      if (!open) return
      event.preventDefault()
      event.stopImmediatePropagation()
      open.click()
    }

    syncImages()
    document.addEventListener('pointerdown', stopImageDrag, true)
    document.addEventListener('click', openImageFromPreview, true)
    document.addEventListener('keydown', protectAtomicImageFromTextDeletion, true)
    window.visualViewport?.addEventListener('resize', syncViewport)
    window.visualViewport?.addEventListener('scroll', syncViewport)
    window.addEventListener('resize', syncViewport)
    window.addEventListener('scroll', syncViewport, { passive: true })

    return () => {
      observer.disconnect()
      document.removeEventListener('pointerdown', stopImageDrag, true)
      document.removeEventListener('click', openImageFromPreview, true)
      document.removeEventListener('keydown', protectAtomicImageFromTextDeletion, true)
      window.visualViewport?.removeEventListener('resize', syncViewport)
      window.visualViewport?.removeEventListener('scroll', syncViewport)
      window.removeEventListener('resize', syncViewport)
      window.removeEventListener('scroll', syncViewport)
    }
  }, [])

  return null
}
