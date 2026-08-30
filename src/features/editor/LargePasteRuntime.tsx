import { useEffect } from 'react'
import './mobileEditorStability.css'

function selectionInsideEditor(editor: HTMLElement): boolean {
  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0) return false
  return editor.contains(selection.getRangeAt(0).commonAncestorContainer)
}

function ensureEditorSelection(editor: HTMLElement, target: Element): boolean {
  if (selectionInsideEditor(editor)) return true

  const targetBlock = target.closest<HTMLElement>('[data-block-id]')
  const anchor = targetBlock && editor.contains(targetBlock)
    ? targetBlock
    : editor.lastElementChild instanceof HTMLElement
      ? editor.lastElementChild
      : editor

  const selection = document.getSelection()
  if (!selection) return false

  editor.focus({ preventScroll: true })
  const range = document.createRange()
  range.selectNodeContents(anchor)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
  return selectionInsideEditor(editor)
}

function directEditorBlock(editor: HTMLElement, element: Element | null): HTMLElement | null {
  const block = element?.closest<HTMLElement>('[data-block-id]') ?? null
  return block?.parentElement === editor ? block : null
}

function elementFromNode(node: Node | null): Element | null {
  return node instanceof Element ? node : node?.parentElement ?? null
}

function localEditableFromElement(
  editor: HTMLElement,
  element: Element | null,
): HTMLElement | null {
  const local = element?.closest<HTMLElement>('[data-editor-local-editable="true"]') ?? null
  return local && editor.contains(local) ? local : null
}

function isSelectionBoundaryBlock(block: HTMLElement): boolean {
  return (
    block.matches(
      '[data-editor-atomic-block], [data-daily-entry-block="true"], [data-code-block="true"], [data-checklist-block="true"], [data-contact-block="true"], [data-image-block="true"], [data-attachment-block="true"]',
    )
    || block.getAttribute('contenteditable') === 'false'
    || block.tagName.toLowerCase() === 'hr'
  )
}

function selectionWithinSameLocalEditable(
  editor: HTMLElement,
  selection: Selection,
): HTMLElement | null {
  if (selection.rangeCount === 0 || !selection.anchorNode || !selection.focusNode) return null
  const anchor = localEditableFromElement(editor, elementFromNode(selection.anchorNode))
  const focus = localEditableFromElement(editor, elementFromNode(selection.focusNode))
  return anchor && anchor === focus ? anchor : null
}

function selectionTouchesAtomicBlock(editor: HTMLElement, selection: Selection): boolean {
  if (selection.isCollapsed || selection.rangeCount === 0) return false
  const range = selection.getRangeAt(0)
  const selectors = [
    '[data-editor-atomic-block]',
    '[data-daily-entry-block="true"]',
    '[data-code-block="true"]',
    '[data-checklist-block="true"]',
    '[data-contact-block="true"]',
    '[data-image-block="true"]',
    '[data-attachment-block="true"]',
  ].join(',')

  return Array.from(editor.querySelectorAll<HTMLElement>(selectors)).some((block) => {
    try {
      return range.intersectsNode(block)
    } catch {
      return false
    }
  })
}

function constrainSelectionToUnit(unit: HTMLElement | null): boolean {
  if (!unit || !unit.isConnected) return false
  const selection = document.getSelection()
  if (!selection) return false

  const range = document.createRange()
  range.selectNodeContents(unit)
  selection.removeAllRanges()
  selection.addRange(range)
  return true
}

function rangeIntersectionWithinBlock(source: Range, block: HTMLElement): Range | null {
  const blockRange = document.createRange()
  blockRange.selectNodeContents(block)

  if (
    source.compareBoundaryPoints(Range.END_TO_START, blockRange) <= 0
    || source.compareBoundaryPoints(Range.START_TO_END, blockRange) >= 0
  ) {
    return null
  }

  const result = document.createRange()

  if (source.compareBoundaryPoints(Range.START_TO_START, blockRange) <= 0) {
    result.setStart(blockRange.startContainer, blockRange.startOffset)
  } else {
    result.setStart(source.startContainer, source.startOffset)
  }

  if (source.compareBoundaryPoints(Range.END_TO_END, blockRange) >= 0) {
    result.setEnd(blockRange.endContainer, blockRange.endOffset)
  } else {
    result.setEnd(source.endContainer, source.endOffset)
  }

  return result.collapsed ? null : result
}

function ensureEditableBlockCaret(block: HTMLElement) {
  if (block.textContent || block.children.length > 0) return
  block.appendChild(document.createElement('br'))
}

function deleteSelectedSheetText(editor: HTMLElement, selection: Selection): boolean {
  if (selection.isCollapsed || selection.rangeCount === 0) return false

  const source = selection.getRangeAt(0).cloneRange()
  const affected = Array.from(editor.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement)
    .filter((block) => !isSelectionBoundaryBlock(block))
    .flatMap((block) => {
      const range = rangeIntersectionWithinBlock(source, block)
      return range ? [{ block, range }] : []
    })

  if (affected.length === 0) return false

  for (let index = affected.length - 1; index >= 0; index -= 1) {
    affected[index].range.deleteContents()
    ensureEditableBlockCaret(affected[index].block)
  }

  const firstBlock = affected[0].block
  const caret = document.createRange()
  caret.selectNodeContents(firstBlock)
  caret.collapse(true)
  selection.removeAllRanges()
  selection.addRange(caret)

  editor.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}

export function LargePasteRuntime() {
  useEffect(() => {
    let lastInteractionBlock: HTMLElement | null = null

    function rememberInteractionTarget(target: EventTarget | null) {
      if (!(target instanceof Element)) return
      const editor = target.closest<HTMLElement>('.editor-surface')
      if (!editor) return

      const block = directEditorBlock(editor, target)
      if (block) lastInteractionBlock = block
    }

    function activeEditor(): HTMLElement | null {
      const active = document.activeElement
      if (active instanceof Element) {
        const editor = active.closest<HTMLElement>('.editor-surface')
        if (editor) return editor
      }

      const blockEditor = lastInteractionBlock?.parentElement
      return blockEditor instanceof HTMLElement && blockEditor.classList.contains('editor-surface')
        ? blockEditor
        : null
    }

    function trackSelectionUnit() {
      const editor = activeEditor()
      if (!editor) return
      const selection = document.getSelection()
      if (!selection || selection.rangeCount === 0) return

      const anchorBlock = directEditorBlock(editor, elementFromNode(selection.anchorNode))
      const focusBlock = directEditorBlock(editor, elementFromNode(selection.focusNode))
      if (anchorBlock) lastInteractionBlock = anchorBlock
      else if (focusBlock) lastInteractionBlock = focusBlock
    }

    function handleSelectAllKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a') return
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('input, textarea')) return

      const editor = target.closest<HTMLElement>('.editor-surface')
      if (!editor) return

      const selection = document.getSelection()
      const anchorElement = elementFromNode(selection?.anchorNode ?? null)
      const local = localEditableFromElement(editor, target)
        ?? localEditableFromElement(editor, anchorElement)

      if (!local) return

      event.preventDefault()
      event.stopPropagation()
      constrainSelectionToUnit(local)
    }

    async function handleBeforeInput(event: InputEvent) {
      const target = event.target
      if (!(target instanceof Element)) return

      const editor = target.closest<HTMLElement>('.editor-surface')
      if (!editor) return

      if (event.inputType.startsWith('delete')) {
        const selection = document.getSelection()
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return

        if (selectionWithinSameLocalEditable(editor, selection)) return
        if (!selectionTouchesAtomicBlock(editor, selection)) return

        event.preventDefault()
        event.stopPropagation()
        deleteSelectedSheetText(editor, selection)
        return
      }

      if (event.inputType !== 'insertFromPaste') return

      // Ordinary clipboard paste is intentionally left to the browser. The old
      // 50-line/64KiB auto-conversion to a code block was removed with the
      // Aurora note-sheet replacement. Only recover Android/WebView paste when
      // it reports insertFromPaste without carrying any payload at all.
      const inlineText = event.dataTransfer?.getData('text/plain') || event.data || ''
      if (inlineText) return

      const clipboard = navigator.clipboard
      if (!clipboard?.readText) return

      event.preventDefault()
      event.stopPropagation()

      try {
        const fallbackText = await clipboard.readText()
        if (!fallbackText || !ensureEditorSelection(editor, target)) return
        document.execCommand('insertText', false, fallbackText)
      } catch {
        window.alert('OANIX no pudo leer este pegado desde Android. El contenido sigue disponible en tu portapapeles para volver a intentarlo.')
      }
    }

    document.addEventListener('pointerdown', (event) => rememberInteractionTarget(event.target), true)
    document.addEventListener('focusin', (event) => rememberInteractionTarget(event.target), true)
    document.addEventListener('selectionchange', trackSelectionUnit)
    document.addEventListener('keydown', handleSelectAllKey, true)
    document.addEventListener('beforeinput', handleBeforeInput, true)
    return () => {
      document.removeEventListener('selectionchange', trackSelectionUnit)
      document.removeEventListener('keydown', handleSelectAllKey, true)
      document.removeEventListener('beforeinput', handleBeforeInput, true)
    }
  }, [])

  return null
}
