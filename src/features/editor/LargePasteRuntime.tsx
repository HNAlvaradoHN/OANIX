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

function editableSelectionUnit(
  editor: HTMLElement,
  element: Element | null,
  fallbackBlock: HTMLElement | null,
): HTMLElement | null {
  if (element) {
    const codeContent = element.closest<HTMLElement>('[data-code-content="true"]')
    if (codeContent && editor.contains(codeContent)) return codeContent

    const checklistText = element.closest<HTMLElement>('[data-checklist-text="true"]')
    if (checklistText && editor.contains(checklistText)) return checklistText

    const dailyTitle = element.closest<HTMLElement>('[data-daily-entry-title="true"]')
    if (dailyTitle && editor.contains(dailyTitle)) return null
  }

  const block = directEditorBlock(editor, element) ?? fallbackBlock
  if (!block || block.parentElement !== editor) return null
  if (block.dataset.dailyEntryBlock === 'true') return null
  if (block.getAttribute('contenteditable') === 'false') return null
  return block
}

function isSelectionBoundaryBlock(block: HTMLElement): boolean {
  return (
    block.matches(
      '[data-daily-entry-block="true"], [data-code-block="true"], [data-checklist-block="true"], [data-contact-block="true"], [data-image-block="true"], [data-attachment-block="true"]',
    )
    || block.getAttribute('contenteditable') === 'false'
    || block.tagName.toLowerCase() === 'hr'
  )
}

function textSelectionRegion(
  editor: HTMLElement,
  block: HTMLElement | null,
): { first: HTMLElement; last: HTMLElement } | null {
  if (!block || block.parentElement !== editor || isSelectionBoundaryBlock(block)) return null

  let first = block
  let last = block

  for (
    let previous = first.previousElementSibling;
    previous instanceof HTMLElement && previous.parentElement === editor && !isSelectionBoundaryBlock(previous);
    previous = first.previousElementSibling
  ) {
    first = previous
  }

  for (
    let next = last.nextElementSibling;
    next instanceof HTMLElement && next.parentElement === editor && !isSelectionBoundaryBlock(next);
    next = last.nextElementSibling
  ) {
    last = next
  }

  return { first, last }
}

function selectionTouchesProtectedIsland(editor: HTMLElement, selection: Selection): boolean {
  if (selection.isCollapsed || selection.rangeCount === 0) return false
  const range = selection.getRangeAt(0)
  const selectors = [
    '[data-daily-entry-block="true"]',
    '[data-editor-selection-island]',
    '[data-code-block="true"]',
    '[data-checklist-block="true"]',
    '[data-contact-block="true"]',
    '[data-image-block="true"]',
    '[data-attachment-block="true"]',
  ].join(',')

  return Array.from(editor.querySelectorAll<HTMLElement>(selectors)).some((island) => {
    try {
      return range.intersectsNode(island)
    } catch {
      return false
    }
  })
}

function selectionCoversEditorContents(editor: HTMLElement, selection: Selection): boolean {
  if (selection.isCollapsed || selection.rangeCount === 0) return false
  if (!selection.anchorNode || !selection.focusNode) return false
  if (!editor.contains(selection.anchorNode) || !editor.contains(selection.focusNode)) return false

  const range = selection.getRangeAt(0)
  const editorRange = document.createRange()
  editorRange.selectNodeContents(editor)

  return (
    range.compareBoundaryPoints(Range.START_TO_START, editorRange) <= 0
    && range.compareBoundaryPoints(Range.END_TO_END, editorRange) >= 0
  )
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

function constrainSelectionToTextRegion(
  editor: HTMLElement,
  block: HTMLElement | null,
  preserveExistingRange: boolean,
): boolean {
  const region = textSelectionRegion(editor, block)
  const selection = document.getSelection()
  if (!region || !selection) return false

  const scope = document.createRange()
  scope.setStart(region.first, 0)
  scope.setEnd(region.last, region.last.childNodes.length)

  if (!preserveExistingRange || selection.rangeCount === 0 || selection.isCollapsed) {
    selection.removeAllRanges()
    selection.addRange(scope)
    return true
  }

  const current = selection.getRangeAt(0)
  const clipped = document.createRange()

  if (current.compareBoundaryPoints(Range.START_TO_START, scope) < 0) {
    clipped.setStart(scope.startContainer, scope.startOffset)
  } else {
    clipped.setStart(current.startContainer, current.startOffset)
  }

  if (current.compareBoundaryPoints(Range.END_TO_END, scope) > 0) {
    clipped.setEnd(scope.endContainer, scope.endOffset)
  } else {
    clipped.setEnd(current.endContainer, current.endOffset)
  }

  if (clipped.collapsed) return false

  selection.removeAllRanges()
  selection.addRange(clipped)
  return true
}

function constrainSelectionToActiveScope(
  editor: HTMLElement,
  unit: HTMLElement | null,
  preserveExistingRange: boolean,
): boolean {
  if (!unit || !unit.isConnected) return false

  if (unit.parentElement === editor && !isSelectionBoundaryBlock(unit)) {
    return constrainSelectionToTextRegion(editor, unit, preserveExistingRange)
  }

  return constrainSelectionToUnit(unit)
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

    function guardSelectionBoundaries() {
      if (adjustingSelection) return
      const editor = activeEditor()
      if (!editor) return

      const selection = document.getSelection()
      if (!selection || selection.rangeCount === 0) return

      if (selection.isCollapsed) {
        rememberSelectionUnit(editor, selection)
        return
      }

      const crossesProtectedIsland = selectionTouchesProtectedIsland(editor, selection)
      const coversWholeEditor = selectionCoversEditorContents(editor, selection)
      if (!crossesProtectedIsland && !coversWholeEditor) {
        rememberSelectionUnit(editor, selection)
        return
      }

      const unit = currentSelectionUnit(editor)
      if (!unit) return

      adjustingSelection = true
      try {
        constrainSelectionToActiveScope(editor, unit, true)
      } finally {
        queueMicrotask(() => {
          adjustingSelection = false
        })
      }
    }

    function handleSelectAllKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a') return
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('input, textarea, [data-daily-entry-title="true"]')) return

      const editor = target.closest<HTMLElement>('.editor-surface')
      if (!editor) return
      const selection = document.getSelection()
      const anchorElement = elementFromNode(selection?.anchorNode ?? null)
      const unit = editableSelectionUnit(
        editor,
        anchorElement,
        directEditorBlock(editor, anchorElement) ?? lastInteractionBlock,
      ) ?? currentSelectionUnit(editor)
      if (!unit) return

      event.preventDefault()
      event.stopPropagation()
      lastSelectionUnit = unit
      constrainSelectionToActiveScope(editor, unit, false)
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
        if (!target.closest('[data-daily-entry-title="true"]')) guardSelectionBoundaries()
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

    function handleDeleteKey(event: KeyboardEvent) {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return
      const target = event.target
      if (target instanceof Element && target.closest('[data-daily-entry-title="true"]')) return
      guardSelectionBoundaries()
    }

    document.addEventListener('pointerdown', rememberPointerInteraction, true)
    document.addEventListener('focusin', rememberFocusInteraction, true)
    document.addEventListener('selectionchange', guardSelectionBoundaries)
    document.addEventListener('keydown', handleSelectAllKey, true)
    document.addEventListener('keydown', handleDeleteKey, true)
    document.addEventListener('paste', handlePaste, true)
    document.addEventListener('beforeinput', handleBeforeInput, true)
    return () => {
      document.removeEventListener('pointerdown', rememberPointerInteraction, true)
      document.removeEventListener('focusin', rememberFocusInteraction, true)
      document.removeEventListener('selectionchange', guardSelectionBoundaries)
      document.removeEventListener('keydown', handleSelectAllKey, true)
      document.removeEventListener('keydown', handleDeleteKey, true)
      document.removeEventListener('paste', handlePaste, true)
      document.removeEventListener('beforeinput', handleBeforeInput, true)
    }
  }, [])

  return null
}
