import { useEffect } from 'react'
import { shouldEncapsulateClipboardPaste } from './largePastePolicy'
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

function codeContentFromBlock(block: HTMLElement | null): HTMLElement | null {
  return block?.querySelector<HTMLElement>('[data-code-content="true"]') ?? null
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

function editableSelectionUnit(
  editor: HTMLElement,
  element: Element | null,
  fallbackBlock: HTMLElement | null,
): HTMLElement | null {
  const local = localEditableFromElement(editor, element)
  if (local) return local

  const block = directEditorBlock(editor, element) ?? fallbackBlock
  if (!block || block.parentElement !== editor) return null
  if (isSelectionBoundaryBlock(block)) return null
  return block
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

function clipboardTextFromBeforeInput(event: InputEvent): string {
  return event.dataTransfer?.getData('text/plain') || event.data || ''
}

export function LargePasteRuntime() {
  useEffect(() => {
    let lastInteractionBlock: HTMLElement | null = null
    let lastSelectionUnit: HTMLElement | null = null
    let adjustingSelection = false
    let handledText = ''
    let handledAt = 0
    const duplicateWindowMs = 10_000

    function rememberInteractionTarget(target: EventTarget | null) {
      if (!(target instanceof Element)) return
      const editor = target.closest<HTMLElement>('.editor-surface')
      if (!editor) return

      const block = directEditorBlock(editor, target)
      if (block) lastInteractionBlock = block

      const unit = editableSelectionUnit(editor, target, block)
      if (unit) lastSelectionUnit = unit
    }

    function rememberPointerInteraction(event: PointerEvent) {
      rememberInteractionTarget(event.target)
    }

    function rememberFocusInteraction(event: FocusEvent) {
      rememberInteractionTarget(event.target)
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

    function rememberSelectionUnit(editor: HTMLElement, selection: Selection) {
      const anchorElement = elementFromNode(selection.anchorNode)
      const anchorBlock = directEditorBlock(editor, anchorElement)
      const anchorUnit = editableSelectionUnit(editor, anchorElement, anchorBlock)

      const focusElement = elementFromNode(selection.focusNode)
      const focusBlock = directEditorBlock(editor, focusElement)
      const focusUnit = editableSelectionUnit(editor, focusElement, focusBlock)

      if (anchorBlock) lastInteractionBlock = anchorBlock
      else if (focusBlock) lastInteractionBlock = focusBlock

      if (anchorUnit && (!focusUnit || anchorUnit === focusUnit)) {
        lastSelectionUnit = anchorUnit
        return
      }

      if (focusUnit && !anchorUnit) lastSelectionUnit = focusUnit
    }

    function currentSelectionUnit(editor: HTMLElement): HTMLElement | null {
      if (lastSelectionUnit?.isConnected && editor.contains(lastSelectionUnit)) {
        return lastSelectionUnit
      }

      const selection = document.getSelection()
      if (selection) rememberSelectionUnit(editor, selection)
      return lastSelectionUnit?.isConnected && editor.contains(lastSelectionUnit)
        ? lastSelectionUnit
        : null
    }

    function trackSelectionUnit() {
      const editor = activeEditor()
      if (!editor) return
      const selection = document.getSelection()
      if (!selection || selection.rangeCount === 0) return
      rememberSelectionUnit(editor, selection)
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

      if (!local) {
        // Let the browser select the outer editing host. Atomic blocks are
        // contenteditable=false, so they behave like the console shell.
        return
      }

      event.preventDefault()
      event.stopPropagation()
      lastSelectionUnit = local
      constrainSelectionToUnit(local)
    }

    function isRecentHandledPaste(): boolean {
      return Boolean(handledText) && performance.now() - handledAt < duplicateWindowMs
    }

    function isDuplicateLargePaste(plainText: string): boolean {
      return plainText === handledText && isRecentHandledPaste()
    }

    function consumeDuplicate(event: ClipboardEvent | InputEvent, plainText: string): boolean {
      if (!plainText || !shouldEncapsulateClipboardPaste(plainText) || !isDuplicateLargePaste(plainText)) {
        return false
      }

      event.preventDefault()
      event.stopPropagation()
      return true
    }

    function encapsulateLargePaste(
      event: ClipboardEvent | InputEvent,
      target: Element,
      plainText: string,
    ) {
      const editor = target.closest<HTMLElement>('.editor-surface')
      if (!editor) return
      if (!plainText || !shouldEncapsulateClipboardPaste(plainText)) return

      if (consumeDuplicate(event, plainText)) return
      if (target.closest('[data-contact-field], [data-daily-entry-title="true"]')) return
      if (target.closest('[data-code-content="true"]')) return

      if (!ensureEditorSelection(editor, target)) {
        event.preventDefault()
        event.stopPropagation()
        window.alert('OANIX no pudo ubicar el pegado grande dentro de la nota. El contenido sigue disponible en tu portapapeles.')
        return
      }

      const frame = editor.closest<HTMLElement>('.editor-frame')
      const codeTool = frame?.querySelector<HTMLButtonElement>('[data-format="code"]')
      if (!codeTool) return

      const existingBlocks = new Set(
        Array.from(editor.querySelectorAll<HTMLElement>('[data-code-block="true"]')),
      )

      event.preventDefault()
      event.stopPropagation()
      handledText = plainText
      handledAt = performance.now()
      codeTool.click()

      const insertedBlock = Array.from(
        editor.querySelectorAll<HTMLElement>('[data-code-block="true"]'),
      ).find((block) => !existingBlocks.has(block)) ?? null
      const activeContent = document.activeElement instanceof Element
        ? document.activeElement.closest<HTMLElement>('[data-code-content="true"]')
        : null
      const content = activeContent && editor.contains(activeContent)
        ? activeContent
        : codeContentFromBlock(insertedBlock)

      if (!content) {
        window.alert('OANIX no pudo preparar el bloque para este pegado grande. El contenido sigue disponible en tu portapapeles.')
        return
      }

      content.textContent = plainText
      content.focus({ preventScroll: true })
      content.dispatchEvent(new Event('input', { bubbles: true }))
      if (insertedBlock) {
        lastInteractionBlock = insertedBlock
        lastSelectionUnit = content
      }
    }

    function handlePaste(event: ClipboardEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      encapsulateLargePaste(event, target, event.clipboardData?.getData('text/plain') ?? '')
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

      // Some Android keyboards/WebViews can deliver a whole clipboard payload as
      // one non-composing insertText event. Only treat that path as a paste after
      // verifying the same large payload is still present on the clipboard.
      if (event.inputType === 'insertText' && !event.isComposing) {
        const bulkText = event.data ?? ''
        if (!bulkText || !shouldEncapsulateClipboardPaste(bulkText)) return

        const clipboard = navigator.clipboard
        if (!clipboard?.readText) return

        event.preventDefault()
        event.stopPropagation()

        try {
          const clipboardText = await clipboard.readText()
          if (clipboardText === bulkText && shouldEncapsulateClipboardPaste(clipboardText)) {
            encapsulateLargePaste(event, target, clipboardText)
            return
          }
        } catch {
          // Clipboard verification is best-effort. Preserve the original bulk
          // insertion below instead of misclassifying dictation/autofill as paste.
        }

        if (!ensureEditorSelection(editor, target)) return
        document.execCommand('insertText', false, bulkText)
        return
      }

      if (event.inputType !== 'insertFromPaste') return

      const plainText = clipboardTextFromBeforeInput(event)
      if (plainText) {
        encapsulateLargePaste(event, target, plainText)
        return
      }

      if (isRecentHandledPaste()) {
        event.preventDefault()
        event.stopPropagation()
        return
      }

      const clipboard = navigator.clipboard
      if (!clipboard?.readText) return

      event.preventDefault()
      event.stopPropagation()

      try {
        const fallbackText = await clipboard.readText()
        if (!fallbackText) return

        if (shouldEncapsulateClipboardPaste(fallbackText)) {
          encapsulateLargePaste(event, target, fallbackText)
          return
        }

        if (!ensureEditorSelection(editor, target)) return
        document.execCommand('insertText', false, fallbackText)
      } catch {
        window.alert('OANIX no pudo leer este pegado desde Android. El contenido sigue disponible en tu portapapeles para volver a intentarlo.')
      }
    }

    document.addEventListener('pointerdown', rememberPointerInteraction, true)
    document.addEventListener('focusin', rememberFocusInteraction, true)
    document.addEventListener('selectionchange', trackSelectionUnit)
    document.addEventListener('keydown', handleSelectAllKey, true)
    document.addEventListener('paste', handlePaste, true)
    document.addEventListener('beforeinput', handleBeforeInput, true)
    return () => {
      document.removeEventListener('pointerdown', rememberPointerInteraction, true)
      document.removeEventListener('focusin', rememberFocusInteraction, true)
      document.removeEventListener('selectionchange', trackSelectionUnit)
      document.removeEventListener('keydown', handleSelectAllKey, true)
      document.removeEventListener('paste', handlePaste, true)
      document.removeEventListener('beforeinput', handleBeforeInput, true)
    }
  }, [])

  return null
}
